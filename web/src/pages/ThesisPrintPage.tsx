import { useEffect } from "react";
import { useParams } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useThesis, useHolding } from "../hooks/useThesis.ts";
import { useWeeklyLogs } from "../hooks/useWeeklyLogs.ts";
import type { Source, WeeklyLog } from "../api/client.ts";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPct(val: string | null): string {
  if (val == null) return "—";
  const num = parseFloat(val);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function impactLabel(impact: string | null): string {
  if (!impact) return "—";
  return impact.charAt(0).toUpperCase() + impact.slice(1);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section mb-8">
      <h2 className="text-sm font-semibold text-brand-500 uppercase tracking-wider mb-3 border-b border-brand-200 pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ThesisPrintPage() {
  const { holdingId } = useParams();
  const { data: thesis, isLoading: thesisLoading } = useThesis(holdingId!);
  const { data: holding, isLoading: holdingLoading } = useHolding(holdingId!);
  const { data: weeklyLogs, isLoading: logsLoading } = useWeeklyLogs(
    holdingId!,
  );

  const isLoading = thesisLoading || holdingLoading || logsLoading;

  useEffect(() => {
    if (!isLoading && thesis) {
      window.print();
    }
  }, [isLoading, thesis]);

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-brand-500">Loading thesis…</div>
    );
  }

  if (!thesis) {
    return (
      <div className="p-8">
        <p className="text-sm text-brand-700">
          No thesis exists for this holding yet. Generate a thesis first, then
          try again.
        </p>
      </div>
    );
  }

  const sources = (thesis.sources as Source[] | null) ?? [];
  const logs = weeklyLogs ?? [];
  const benchmark = holding?.benchmark ?? "S&P 500";
  const content = thesis.content ?? "";

  return (
    <div className="print-root mx-auto max-w-3xl p-8 bg-white text-brand-900">
      <div className="no-print mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-accent-600 rounded hover:bg-accent-700"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Header */}
      <header className="print-section mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-brand-900">
            {holding?.ticker ?? ""}
          </h1>
          {holding && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium capitalize border border-brand-300 text-brand-700">
              {holding.direction}
            </span>
          )}
        </div>
        {holding && (
          <p className="text-sm text-brand-500 mt-1">{holding.companyName}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm text-brand-500">
          <span>Generated {formatDate(thesis.createdAt)}</span>
          <span className="text-brand-300">|</span>
          <span>Benchmark: {benchmark}</span>
          <span className="text-brand-300">|</span>
          <span className="capitalize">Status: {holding?.status ?? "active"}</span>
        </div>
      </header>

      <Section title="Thesis">
        {content.trim() === "" ? (
          <p className="text-sm text-brand-400">No thesis content recorded.</p>
        ) : (
          <div className="markdown-body text-sm text-brand-800 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </Section>

      <Section title="Sources">
        {sources.length === 0 ? (
          <p className="text-sm text-brand-400">No sources recorded.</p>
        ) : (
          <ul className="text-sm space-y-1.5">
            {sources.map((source, i) => (
              <li key={i} className="flex items-center gap-2 print-avoid-break">
                <span className="text-brand-800">{source.title}</span>
                {source.url && (
                  <span className="text-brand-400 break-all">{source.url}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Weekly Log">
        {logs.length === 0 ? (
          <p className="text-sm text-brand-400">No weekly logs recorded.</p>
        ) : (
          <table className="weekly-log-table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-300 text-left">
                <th className="py-1.5 pr-3 font-medium text-brand-500">Week</th>
                <th className="py-1.5 pr-3 font-medium text-brand-500">
                  Price %
                </th>
                <th className="py-1.5 pr-3 font-medium text-brand-500">
                  vs Index %
                </th>
                <th className="py-1.5 pr-3 font-medium text-brand-500">
                  Relative %
                </th>
                <th className="py-1.5 pr-3 font-medium text-brand-500">
                  Impact
                </th>
                <th className="py-1.5 font-medium text-brand-500">Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: WeeklyLog) => (
                <tr
                  key={log.id}
                  className="border-b border-brand-100 align-top print-avoid-break"
                >
                  <td className="py-1.5 pr-3">{log.weekLabel ?? "—"}</td>
                  <td className="py-1.5 pr-3 font-mono">
                    {formatPct(log.priceChangePct)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">
                    {formatPct(log.indexChangePct)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">
                    {formatPct(log.relativePerf)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {impactLabel(log.thesisImpact)}
                  </td>
                  <td className="py-1.5 text-brand-700">
                    {log.summary ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
