import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import clsx from "clsx";
import type { Holding } from "../api/client.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { DirectionBadge } from "./DirectionBadge.tsx";

const columnHelper = createColumnHelper<Holding>();

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getColumns(onDelete?: (id: string) => void) {
  return [
    columnHelper.accessor("ticker", {
      header: "Ticker",
      cell: (info) => (
        <span className="font-medium text-brand-900">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("companyName", {
      header: "Company",
      cell: (info) => (
        <span className="text-brand-700 truncate block max-w-[200px]">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("direction", {
      header: "Position",
      cell: (info) => <DirectionBadge direction={info.getValue()} />,
    }),
    columnHelper.accessor("createdAt", {
      header: "Thesis Date",
      cell: (info) => (
        <span className="text-sm text-brand-500">{formatDate(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("lastUpdated", {
      header: "Last Update",
      cell: (info) => (
        <span className="text-sm text-brand-500">{formatDate(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("latestImpact", {
      header: "Status",
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: "weekChange",
      header: () => <span className="text-right block">Week Chg</span>,
      cell: () => (
        <span className="font-mono tabular-nums text-sm text-brand-500 text-right block">
          --
        </span>
      ),
    }),
    ...(onDelete
      ? [
          columnHelper.display({
            id: "actions",
            header: "",
            cell: (info) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const ticker = info.row.original.ticker;
                  if (window.confirm(`Remove ${ticker}?`)) {
                    onDelete(info.row.original.id);
                  }
                }}
                className="text-brand-500 hover:text-status-red-700 text-sm transition-colors"
                aria-label={`Delete ${info.row.original.ticker}`}
              >
                Delete
              </button>
            ),
          }),
        ]
      : []),
  ];
}

interface HoldingsTableProps {
  data: Holding[];
  onDelete?: (id: string) => void;
}

export function HoldingsTable({ data, onDelete }: HoldingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "ticker", desc: false },
  ]);

  const columns = getColumns(onDelete);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-surface-card rounded-md shadow-sm border border-brand-200 overflow-hidden">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-brand-50 border-b border-brand-200">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={clsx(
                    "px-3 py-3 text-left text-xs font-medium text-brand-500 uppercase tracking-wider",
                    header.column.getCanSort() && "cursor-pointer select-none",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: " \u2191",
                      desc: " \u2193",
                    }[header.column.getIsSorted() as string] ?? null}
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
              className="border-b border-brand-100 last:border-b-0 hover:bg-brand-100 cursor-pointer transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
