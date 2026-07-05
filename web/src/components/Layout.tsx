import { useState, useEffect } from "react";
import { Outlet, Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback.tsx";
import {
  AddHoldingModal,
  type AddHoldingFormData,
} from "./AddHoldingModal.tsx";
import { GenerationProgress } from "./GenerationProgress.tsx";
import { BulkUploadModal } from "./BulkUploadModal.tsx";
import { BulkProgressBanner } from "./BulkProgressBanner.tsx";
import { BulkResultsModal } from "./BulkResultsModal.tsx";
import { ToastContainer } from "./Toast.tsx";
import { useGenerateThesis } from "../hooks/useGenerateThesis.ts";
import { useToast } from "../hooks/useToast.ts";
import { useBulkProgress } from "../hooks/useBulkProgress.ts";
import { useBulkRetry } from "../hooks/useBulkRetry.ts";
import { useMonitoringProgress } from "../hooks/useMonitoringProgress.ts";
import { useMonitoringStatus } from "../hooks/useMonitoringStatus.ts";
import {
  startBulkGeneration,
  cancelBulkGeneration,
} from "../api/bulk.ts";
import {
  triggerMonitoringBatch,
  getGenerationStatus,
} from "../api/client.ts";

interface GenerationState {
  holdingId: string;
  ticker: string;
  bullets: string;
  /** True when restored after a page reload — poll without re-triggering. */
  resume: boolean;
}

// Survives page reloads so an in-flight generation resumes showing progress.
const ACTIVE_GENERATION_KEY = "activeGeneration";

type BulkStep = "idle" | "upload" | "generating" | "complete";

export function Layout() {
  const [modalOpen, setModalOpen] = useState(false);
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const generateMutation = useGenerateThesis();
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  // Bulk upload state
  const [bulkStep, setBulkStep] = useState<BulkStep>("idle");
  const [bulkBatchId, setBulkBatchId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const bulkProgress = useBulkProgress(
    bulkStep === "generating" || bulkStep === "complete" ? bulkBatchId : null,
  );
  const retryMutation = useBulkRetry();

  // Monitoring state
  const [monitoringActive, setMonitoringActive] = useState(false);
  const monitoringProgress = useMonitoringProgress(monitoringActive);
  const monitoringStatus = useMonitoringStatus();

  // If a monitoring batch is already running on page load, pick it up
  useEffect(() => {
    if (monitoringStatus.data?.status === "active") {
      setMonitoringActive(true);
    }
  }, [monitoringStatus.data]);

  // If a generation was in flight when the page reloaded, resume its progress
  useEffect(() => {
    const stored = sessionStorage.getItem(ACTIVE_GENERATION_KEY);
    if (!stored) return;

    let saved: { holdingId: string; ticker: string };
    try {
      saved = JSON.parse(stored);
    } catch {
      sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
      return;
    }

    getGenerationStatus(saved.holdingId)
      .then((status) => {
        if (status?.status === "running") {
          setGeneration({
            holdingId: saved.holdingId,
            ticker: saved.ticker,
            bullets: "",
            resume: true,
          });
        } else {
          // Finished (or lost) while the page was away — nothing to resume
          sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
          queryClient.invalidateQueries({ queryKey: ["holdings"] });
        }
      })
      .catch(() => sessionStorage.removeItem(ACTIVE_GENERATION_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When monitoring batch completes
  useEffect(() => {
    if (monitoringActive && monitoringProgress.isComplete) {
      setMonitoringActive(false);
      queryClient.invalidateQueries({ queryKey: ["holdings"] });

      if (monitoringProgress.failures.length > 0) {
        addToast(
          `${monitoringProgress.completed} of ${monitoringProgress.total} holdings monitored. ${monitoringProgress.failed} failed.`,
          "error",
        );
      } else {
        addToast(
          `All ${monitoringProgress.completed} holdings monitored successfully.`,
          "success",
        );
      }
    }
  }, [monitoringActive, monitoringProgress.isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // When bulk generation completes, transition to complete step
  useEffect(() => {
    if (bulkStep === "generating" && bulkProgress.isComplete) {
      setBulkStep("complete");
      queryClient.invalidateQueries({ queryKey: ["holdings"] });

      if (bulkProgress.failures.length > 0) {
        setShowResults(true);
        addToast(
          `${bulkProgress.completed} of ${bulkProgress.total} theses generated. ${bulkProgress.failed} failed.`,
          "error",
        );
      } else {
        addToast(
          `All ${bulkProgress.completed} theses generated successfully.`,
          "success",
        );
      }
    }
  }, [bulkStep, bulkProgress.isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(data: AddHoldingFormData) {
    generateMutation.mutate(
      {
        holding: {
          ticker: data.ticker,
          companyName: data.companyName,
          direction: data.direction,
          benchmark: data.benchmark,
        },
        bullets: data.bullets,
        files: data.files,
      },
      {
        onSuccess: (result) => {
          setModalOpen(false);
          sessionStorage.setItem(
            ACTIVE_GENERATION_KEY,
            JSON.stringify({
              holdingId: result.holdingId,
              ticker: result.ticker,
            }),
          );
          setGeneration({
            holdingId: result.holdingId,
            ticker: result.ticker,
            bullets: result.bullets,
            resume: false,
          });
        },
        onError: (err) => {
          addToast(
            err instanceof Error ? err.message : "Failed to create holding.",
            "error",
          );
        },
      },
    );
  }

  function handleGenerationComplete() {
    sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
    if (generation) {
      addToast(`Thesis generated for ${generation.ticker}.`, "success");
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    }
    setGeneration(null);
  }

  function handleRetry() {
    sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
    setGeneration(null);
    setModalOpen(true);
  }

  function handleGenerationStale() {
    sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
    setGeneration(null);
    queryClient.invalidateQueries({ queryKey: ["holdings"] });
  }

  async function handleBulkStart(batchId: string, excludeRows: number[]) {
    try {
      await startBulkGeneration(batchId, excludeRows);
      setBulkBatchId(batchId);
      setBulkStep("generating");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to start bulk generation.",
        "error",
      );
    }
  }

  async function handleBulkCancel() {
    if (!bulkBatchId) return;
    try {
      await cancelBulkGeneration(bulkBatchId);
      setBulkStep("idle");
      setBulkBatchId(null);
      addToast("Remaining generations cancelled.", "success");
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to cancel.",
        "error",
      );
    }
  }

  function handleBulkRetry(holdingIds?: string[]) {
    if (!bulkBatchId) return;
    retryMutation.mutate(
      { batchId: bulkBatchId, holdingIds },
      {
        onSuccess: () => {
          // Drop the completed batch's cached status so polling restarts fresh
          queryClient.removeQueries({
            queryKey: ["bulkProgress", bulkBatchId],
          });
          setShowResults(false);
          setBulkStep("generating");
        },
        onError: (err) => {
          addToast(
            err instanceof Error ? err.message : "Retry failed.",
            "error",
          );
        },
      },
    );
  }

  function handleBulkDismiss() {
    setShowResults(false);
    setBulkStep("idle");
    setBulkBatchId(null);
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <header className="h-14 border-b border-brand-200 bg-white flex items-center justify-between px-6">
        <Link
          to="/"
          className="text-lg font-semibold text-brand-900 tracking-tight hover:text-accent-600 transition-colors"
        >
          Thesis Tracker
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                const result = await triggerMonitoringBatch();
                if (result.status === "active") {
                  // Drop any previous run's cached status before polling
                  queryClient.removeQueries({ queryKey: ["monitoringStatus"] });
                  setMonitoringActive(true);
                } else if (result.message) {
                  addToast(result.message, "success");
                }
              } catch (err) {
                addToast(
                  err instanceof Error ? err.message : "Failed to trigger monitoring.",
                  "error",
                );
              }
            }}
            disabled={monitoringActive}
            className="border border-brand-200 bg-surface-card hover:bg-brand-100 text-brand-700 text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {monitoringActive ? "Monitoring..." : "Run Weekly Monitoring"}
          </button>
          <button
            onClick={() => setBulkStep("upload")}
            className="border border-brand-200 bg-surface-card hover:bg-brand-100 text-brand-700 text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors"
          >
            Upload Spreadsheet
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors"
          >
            + Add Holding
          </button>
        </div>
      </header>

      {monitoringActive && !monitoringProgress.isComplete && (
        <BulkProgressBanner
          completed={monitoringProgress.completed}
          failed={monitoringProgress.failed}
          total={monitoringProgress.total}
          estimatedTimeRemaining={monitoringProgress.estimatedTimeRemaining}
          label="Monitoring holdings"
        />
      )}

      {bulkStep === "generating" && (
        <BulkProgressBanner
          completed={bulkProgress.completed}
          failed={bulkProgress.failed}
          total={bulkProgress.total}
          estimatedTimeRemaining={bulkProgress.estimatedTimeRemaining}
          onCancel={handleBulkCancel}
        />
      )}

      {bulkStep === "complete" && bulkProgress.failures.length === 0 && (
        <div className="bg-success-bg border-b border-success-border px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm font-medium text-success-text">
              All {bulkProgress.completed} theses generated successfully.
            </p>
            <button
              type="button"
              onClick={handleBulkDismiss}
              className="text-sm text-success-text hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {bulkStep === "complete" && bulkProgress.failures.length > 0 && (
        <div className="bg-warning-bg border-b border-warning-border px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm font-medium text-warning-text">
              {bulkProgress.completed} of {bulkProgress.total} theses
              generated. {bulkProgress.failed} failed.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowResults(true)}
                className="text-sm text-warning-text hover:underline font-medium"
              >
                View Details
              </button>
              <button
                type="button"
                onClick={handleBulkDismiss}
                className="text-sm text-warning-text hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-10">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Outlet
            context={{
              onAddHolding: () => setModalOpen(true),
              onBulkUpload: () => setBulkStep("upload"),
              addToast,
            }}
          />
        </ErrorBoundary>
      </main>

      <AddHoldingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        isSubmitting={generateMutation.isPending}
      />

      <BulkUploadModal
        open={bulkStep === "upload"}
        onOpenChange={(open) => {
          if (!open) setBulkStep("idle");
        }}
        onStartGeneration={handleBulkStart}
      />

      <BulkResultsModal
        open={showResults}
        onOpenChange={(open) => {
          if (!open) setShowResults(false);
        }}
        completed={bulkProgress.completed}
        failed={bulkProgress.failed}
        failures={bulkProgress.failures}
        onRetry={handleBulkRetry}
        isRetrying={retryMutation.isPending}
      />

      {generation && (
        <GenerationProgress
          holdingId={generation.holdingId}
          ticker={generation.ticker}
          bullets={generation.bullets}
          resume={generation.resume}
          onComplete={handleGenerationComplete}
          onRetry={handleRetry}
          onStale={handleGenerationStale}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
