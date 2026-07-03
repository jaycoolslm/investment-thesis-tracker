import { useEffect } from "react";
import { useParams } from "react-router";
import { useThesis, useHolding } from "../hooks/useThesis.ts";
import { useWeeklyLogs } from "../hooks/useWeeklyLogs.ts";
import type {
  Valuation,
  Risk,
  Source,
  WeeklyLog,
  PillarRef,
} from "../api/client.ts";

const sourceTypeLabels: Record<string, string> = {
  web: "Web",
  filing: "Filing",
  news: "News",
  broker_research: "Research",
};

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

// Narrative HTML fields come from Tiptap and are safe, app-authored content.
function Prose({ html }: { html: string | null }) {
  if (!html || html.trim() === "") {
    return <p className="text-sm text-brand-400">—</p>;
  }
  return (
    <div
      className="prose-print text-sm text-brand-800 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

  const valuation = thesis.valuation as Valuation | null;
  const assumptions = (thesis.assumptions as string[] | null) ?? [];
  const risks = (thesis.risks as Risk[] | null) ?? [];
  const sources = ((thesis.sources as Source[] | null) ?? []).filter(
    (s) => s.type !== "broker_research",
  );
  const logs = weeklyLogs ?? [];
  const benchmark = holding?.benchmark ?? "S&P 500";

  const valuationRows: Array<[string, string | null]> = valuation
    ? [
        ["Methodology", valuation.methodology],
        [
          "Current price",
          valuation.currentPrice != null
            ? valuation.currentPrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : null,
        ],
        ["Upside case", valuation.upsideCase],
        ["Base case", valuation.baseCase],
        ["Downside case", valuation.downsideCase],
      ]
    : [];

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

      <Section title="Summary">
        <Prose html={thesis.summary} />
      </Section>

      <Section title="Thesis Pillars">
        {thesis.pillars.length === 0 ? (
          <p className="text-sm text-brand-400">No pillars recorded.</p>
        ) : (
          <div className="space-y-4">
            {thesis.pillars.map((pillar) => (
              <div key={pillar.id} className="print-avoid-break">
                <h3 className="text-sm font-semibold text-brand-900 mb-1">
                  {pillar.title}
                </h3>
                <Prose html={pillar.body} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Quality Assessment">
        <Prose html={thesis.qualityAssess} />
      </Section>

      <Section title="Valuation">
        {valuationRows.length === 0 ? (
          <p className="text-sm text-brand-400">No valuation recorded.</p>
        ) : (
          <dl className="text-sm">
            {valuationRows.map(([key, value]) =>
              value ? (
                <div
                  key={key}
                  className="flex gap-3 py-1 border-b border-brand-100 print-avoid-break"
                >
                  <dt className="w-32 shrink-0 font-medium text-brand-500">
                    {key}
                  </dt>
                  <dd className="text-brand-800">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        )}
      </Section>

      <Section title="Assumptions">
        {assumptions.length === 0 ? (
          <p className="text-sm text-brand-400">No assumptions recorded.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-brand-800 space-y-1">
            {assumptions.map((item, i) => (
              <li key={i} className="print-avoid-break">
                {item}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Risks">
        {risks.length === 0 ? (
          <p className="text-sm text-brand-400">No risks recorded.</p>
        ) : (
          <ul className="text-sm text-brand-800 space-y-2">
            {risks.map((risk, i) => (
              <li
                key={i}
                className="flex items-start gap-2 print-avoid-break"
              >
                <span className="shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase border border-brand-400 text-brand-700">
                  {risk.severity}
                </span>
                <span>{risk.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sources">
        {sources.length === 0 ? (
          <p className="text-sm text-brand-400">No sources recorded.</p>
        ) : (
          <ul className="text-sm space-y-1.5">
            {sources.map((source, i) => (
              <li key={i} className="flex items-center gap-2 print-avoid-break">
                {source.type && (
                  <span className="text-xs font-medium text-brand-500 border border-brand-300 px-1.5 py-0.5 rounded">
                    {sourceTypeLabels[source.type] ?? source.type}
                  </span>
                )}
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
              {logs.map((log: WeeklyLog) => {
                const pillars = log.pillarRefs as PillarRef[] | null;
                return (
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
                      {pillars && pillars.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {pillars.map((p) => (
                            <span
                              key={p.pillarId}
                              className="text-[11px] border border-brand-300 px-1 py-0.5 rounded"
                            >
                              {p.pillarTitle}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
