import { useState } from "react";
import { useParams, Link } from "react-router";
import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { useThesis, useHolding } from "../hooks/useThesis.ts";
import { DirectionBadge } from "../components/DirectionBadge.tsx";
import { LoadingSkeleton } from "../components/LoadingSkeleton.tsx";
import { SummaryEditor } from "../components/thesis/SummaryEditor.tsx";
import { PillarEditor } from "../components/thesis/PillarEditor.tsx";
import { QualityEditor } from "../components/thesis/QualityEditor.tsx";
import { ValuationEditor } from "../components/thesis/ValuationEditor.tsx";
import { AssumptionsEditor } from "../components/thesis/AssumptionsEditor.tsx";
import { RisksEditor } from "../components/thesis/RisksEditor.tsx";
import { SourcesList } from "../components/thesis/SourcesList.tsx";
import { BrokerResearchPanel } from "../components/thesis/BrokerResearchPanel.tsx";
import { BenchmarkEditor } from "../components/thesis/BenchmarkEditor.tsx";
import { StatusEditor } from "../components/thesis/StatusEditor.tsx";
import { WeeklyLogTable } from "../components/thesis/WeeklyLogTable.tsx";
import { useWeeklyLogs } from "../hooks/useWeeklyLogs.ts";
import type { Valuation, Risk, Source } from "../api/client.ts";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildTabs(logCount: number) {
  return [
    { value: "summary", label: "Summary & Pillars" },
    { value: "quality", label: "Quality & Valuation" },
    { value: "risks", label: "Assumptions & Risks" },
    { value: "sources", label: "Sources" },
    {
      value: "log",
      label: logCount > 0 ? `Weekly Log (${logCount})` : "Weekly Log",
    },
  ];
}

export function ThesisDetailPage() {
  const { holdingId } = useParams();
  const { data: thesis, isLoading: thesisLoading, isError: thesisError } = useThesis(holdingId!);
  const { data: holding, isLoading: holdingLoading } = useHolding(holdingId!);
  const { data: weeklyLogs } = useWeeklyLogs(holdingId!);
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [holdingStatus, setHoldingStatus] = useState<
    "active" | "closed" | "paused" | null
  >(null);

  const logCount = weeklyLogs?.length ?? 0;
  const isLoading = thesisLoading || holdingLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (thesisError || !thesis) {
    return (
      <div>
        <Link
          to="/"
          className="text-sm text-accent-600 hover:underline mb-4 inline-flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Holdings
        </Link>
        <div className="bg-error-bg border border-error-border rounded-md p-4 mt-4">
          <p className="text-sm text-error-text">
            No thesis found for this holding. Generate a thesis first from the
            dashboard.
          </p>
        </div>
      </div>
    );
  }

  const currentBenchmark = benchmark ?? holding?.benchmark ?? "S&P 500";

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm text-accent-600 hover:underline inline-flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Holdings
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-brand-900">
            {holding?.ticker ?? ""}
          </h2>
          {holding && <DirectionBadge direction={holding.direction} />}
        </div>

        {holding && (
          <p className="text-sm text-brand-500 mt-1">
            {holding.companyName}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 text-sm text-brand-500">
          <span>Generated {formatDate(thesis.createdAt)}</span>
          <span className="text-brand-300">|</span>
          <span>Benchmark:</span>
          <BenchmarkEditor
            holdingId={holdingId!}
            currentBenchmark={currentBenchmark}
            onUpdate={setBenchmark}
          />
          <span className="text-brand-300">|</span>
          <span>Status:</span>
          <StatusEditor
            holdingId={holdingId!}
            currentStatus={holdingStatus ?? holding?.status ?? "active"}
            onUpdate={setHoldingStatus}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root defaultValue="summary">
        <Tabs.List className="flex border-b border-brand-200 mb-6" aria-label="Thesis sections">
          {buildTabs(logCount).map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={clsx(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                "text-brand-500 border-transparent",
                "hover:text-brand-700 hover:border-brand-300",
                "data-[state=active]:text-accent-600 data-[state=active]:border-accent-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 rounded-t",
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="summary">
          <SummaryEditor thesisId={thesis.id} initialValue={thesis.summary} />
          <PillarEditor thesisId={thesis.id} pillars={thesis.pillars} />
        </Tabs.Content>

        <Tabs.Content value="quality">
          <QualityEditor thesisId={thesis.id} initialValue={thesis.qualityAssess} />
          <ValuationEditor
            thesisId={thesis.id}
            initialValue={thesis.valuation as Valuation | null}
          />
        </Tabs.Content>

        <Tabs.Content value="risks">
          <AssumptionsEditor
            thesisId={thesis.id}
            initialAssumptions={(thesis.assumptions as string[]) ?? []}
          />
          <RisksEditor
            thesisId={thesis.id}
            initialRisks={(thesis.risks as Risk[]) ?? []}
          />
        </Tabs.Content>

        <Tabs.Content value="sources">
          <SourcesList sources={(thesis.sources as Source[]) ?? []} />
          <BrokerResearchPanel holdingId={holdingId!} />
        </Tabs.Content>

        <Tabs.Content value="log">
          <WeeklyLogTable
            logs={weeklyLogs ?? []}
            holdingId={holdingId!}
            hasThesis={!!thesis}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
