import { useState } from "react";
import { Outlet, Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AddHoldingModal,
  type AddHoldingFormData,
} from "./AddHoldingModal.tsx";
import { GenerationProgress } from "./GenerationProgress.tsx";
import { ToastContainer } from "./Toast.tsx";
import { useGenerateThesis } from "../hooks/useGenerateThesis.ts";
import { useToast } from "../hooks/useToast.ts";

interface GenerationState {
  holdingId: string;
  ticker: string;
  bullets: string;
  hasDocuments: boolean;
}

export function Layout() {
  const [modalOpen, setModalOpen] = useState(false);
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const generateMutation = useGenerateThesis();
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

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
          setGeneration({
            holdingId: result.holdingId,
            ticker: result.ticker,
            bullets: result.bullets,
            hasDocuments: result.hasDocuments,
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
    if (generation) {
      addToast(`Thesis generated for ${generation.ticker}.`, "success");
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    }
    setGeneration(null);
  }

  function handleRetry() {
    setGeneration(null);
    setModalOpen(true);
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
        <button
          onClick={() => setModalOpen(true)}
          className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors"
        >
          + Add Holding
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 pb-10">
        <Outlet context={{ onAddHolding: () => setModalOpen(true), addToast }} />
      </main>

      <AddHoldingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        isSubmitting={generateMutation.isPending}
      />

      {generation && (
        <GenerationProgress
          holdingId={generation.holdingId}
          ticker={generation.ticker}
          bullets={generation.bullets}
          hasDocuments={generation.hasDocuments}
          onComplete={handleGenerationComplete}
          onRetry={handleRetry}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
