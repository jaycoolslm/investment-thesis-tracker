import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import clsx from "clsx";
import type { Holding } from "../api/client.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { DirectionBadge } from "./DirectionBadge.tsx";

const columnHelper = createColumnHelper<Holding>();

function SortAscIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block ml-1">
      <path d="M7 3L11 8H3L7 3Z" fill="currentColor" />
    </svg>
  );
}

function SortDescIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block ml-1">
      <path d="M7 11L3 6H11L7 11Z" fill="currentColor" />
    </svg>
  );
}

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
      header: "Impact",
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

export interface DashboardFilter {
  searchQuery: string;
  activeFilters: string[];
}

function holdingsGlobalFilterFn(
  row: Row<Holding>,
  _columnId: string,
  filterValue: DashboardFilter,
): boolean {
  const { searchQuery, activeFilters } = filterValue;
  const holding = row.original;

  // Search filter: match ticker or companyName (case-insensitive, substring)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const matchesTicker = holding.ticker.toLowerCase().includes(q);
    const matchesCompany = holding.companyName.toLowerCase().includes(q);
    if (!matchesTicker && !matchesCompany) return false;
  }

  // Chip filters (skip if "All" is active or no filters)
  if (activeFilters.length === 0 || activeFilters.includes("All")) {
    return true;
  }

  // Direction filter
  const directionFilters = activeFilters.filter(
    (f) => f === "Long" || f === "Short",
  );
  if (directionFilters.length > 0) {
    if (!directionFilters.some((f) => f.toLowerCase() === holding.direction)) {
      return false;
    }
  }

  // Impact filter
  const impactFilters = activeFilters.filter(
    (f) => f === "Strengthened" || f === "Weakened" || f === "Unchanged",
  );
  if (impactFilters.length > 0) {
    if (
      !impactFilters.some((f) => f.toLowerCase() === holding.latestImpact)
    ) {
      return false;
    }
  }

  // Holding status filter (active/closed/paused)
  const holdingStatusFilters = activeFilters.filter(
    (f) => f === "Active" || f === "Closed" || f === "Paused",
  );
  if (holdingStatusFilters.length > 0) {
    if (
      !holdingStatusFilters.some(
        (f) => f.toLowerCase() === holding.status,
      )
    ) {
      return false;
    }
  }

  return true;
}

interface HoldingsTableProps {
  data: Holding[];
  onDelete?: (id: string) => void;
  onRowClick?: (id: string) => void;
  globalFilter?: DashboardFilter;
  onClearFilters?: () => void;
}

export function HoldingsTable({
  data,
  onDelete,
  onRowClick,
  globalFilter,
  onClearFilters,
}: HoldingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "ticker", desc: false },
  ]);

  const columns = getColumns(onDelete);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: globalFilter ?? { searchQuery: "", activeFilters: ["All"] },
    },
    onSortingChange: setSorting,
    globalFilterFn: holdingsGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none"
                  }
                  className={clsx(
                    "px-3 py-3 text-left text-xs font-medium text-brand-500 uppercase tracking-wider",
                    header.column.getCanSort() && "cursor-pointer select-none",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && <SortAscIcon />}
                    {header.column.getIsSorted() === "desc" && <SortDescIcon />}
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
              onClick={() => onRowClick?.(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-16 text-center">
                <p className="text-lg font-medium text-brand-800">
                  No holdings match your search.
                </p>
                <p className="text-sm text-brand-500 mt-2">
                  Try a different ticker or clear your filters.
                </p>
                {onClearFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="mt-4 text-sm text-accent-600 hover:text-accent-700 font-medium transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
