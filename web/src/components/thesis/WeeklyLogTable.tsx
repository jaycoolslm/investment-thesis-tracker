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

const columnHelper = createColumnHelper<WeeklyLog>();

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
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("priceChangePct", {
    header: "Price %",
    cell: (info) => (
      <span className="font-mono text-sm">{formatPct(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor("indexChangePct", {
    header: "vs Index %",
    cell: (info) => (
      <span className="font-mono text-sm">{formatPct(info.getValue())}</span>
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
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
];

interface WeeklyLogTableProps {
  logs: WeeklyLog[];
}

export function WeeklyLogTable({ logs }: WeeklyLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: logs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (logs.length === 0) {
    return (
      <div className="bg-surface-card rounded-lg p-8 shadow-sm border border-brand-200 text-center">
        <p className="text-sm text-brand-400">
          Weekly monitoring is not yet active for this holding.
        </p>
        <p className="text-xs text-brand-300 mt-1">
          Weekly logs will appear here once automated monitoring begins.
        </p>
      </div>
    );
  }

  return (
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
