import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import clsx from "clsx";
import type { WeeklyLog } from "../../api/client.ts";
import { useTriggerWeeklyMonitoring } from "../../hooks/useWeeklyMonitoring.ts";
import { useToast } from "../../hooks/useToast.ts";

const columnHelper = createColumnHelper<WeeklyLog>();

function formatPct(val: string | null): string {
  if (val == null) return "\u2014";
  const num = parseFloat(val);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function pctColorClass(val: string | null): string {
  if (val == null) return "";
  const num = parseFloat(val);
  if (num > 0) return "text-status-green-600";
  if (num < 0) return "text-status-red-600";
  return "";
}

function impactLabel(impact: string | null): string {
  if (!impact) return "\u2014";
  return impact.charAt(0).toUpperCase() + impact.slice(1);
}

function impactClass(impact: string | null): string {
  switch (impact) {
    case "strengthened":
      return "text-status-green-600 bg-status-green-50";
    case "weakened":
      return "text-status-red-600 bg-status-red-50";
    default:
      return "text-brand-500 bg-brand-50";
  }
}

const columns = [
  columnHelper.accessor("weekLabel", {
    header: "Week",
    cell: (info) => info.getValue() ?? "\u2014",
  }),
  columnHelper.accessor("priceChangePct", {
    header: "Price %",
    cell: (info) => (
      <span className={clsx("font-mono text-sm", pctColorClass(info.getValue()))}>
        {formatPct(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("indexChangePct", {
    header: "vs Index %",
    cell: (info) => (
      <span className="font-mono text-sm">{formatPct(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor("relativePerf", {
    header: "Relative %",
    cell: (info) => (
      <span className={clsx("font-mono text-sm", pctColorClass(info.getValue()))}>
        {formatPct(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("thesisImpact", {
    header: "Impact",
    cell: (info) => (
      <span
        className={clsx(
          "text-xs font-medium px-2 py-0.5 rounded-full",
          impactClass(info.getValue()),
        )}
      >
        {impactLabel(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("summary", {
    header: "Summary",
    cell: (info) => (
      <span className="text-sm text-brand-700 line-clamp-2">
        {info.getValue() ?? "\u2014"}
      </span>
    ),
  }),
];

interface WeeklyLogTableProps {
  logs: WeeklyLog[];
  holdingId: string;
  hasThesis: boolean;
}

export function WeeklyLogTable({
  logs,
  holdingId,
  hasThesis,
}: WeeklyLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const trigger = useTriggerWeeklyMonitoring(holdingId);
  const { addToast } = useToast();

  const table = useReactTable({
    data: logs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function handleTrigger() {
    trigger.mutate(undefined, {
      onError: (err) => {
        addToast(
          err instanceof Error ? err.message : "Weekly check failed",
          "error",
        );
      },
    });
  }

  const triggerButton = (
    <button
      onClick={handleTrigger}
      disabled={trigger.isPending || !hasThesis}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {trigger.isPending ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Analysing...
        </>
      ) : (
        "Run Weekly Check"
      )}
    </button>
  );

  if (logs.length === 0) {
    return (
      <div className="bg-surface-card rounded-lg p-8 shadow-sm border border-brand-200 text-center">
        <p className="text-sm text-brand-400 mb-4">
          {hasThesis
            ? "No weekly logs yet. Run a weekly check to analyse this holding against its thesis."
            : "Generate a thesis first, then run weekly checks to monitor it."}
        </p>
        {triggerButton}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{triggerButton}</div>

      <div className="bg-surface-card rounded-lg shadow-sm border border-brand-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-brand-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-brand-500 uppercase tracking-wider cursor-pointer select-none hover:text-brand-700"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{
                          asc: " \u2191",
                          desc: " \u2193",
                        }[header.column.getIsSorted() as string] ?? ""}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-brand-100 last:border-0 hover:bg-brand-50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
