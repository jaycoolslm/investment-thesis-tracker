import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import type { BulkPreviewRow } from "../api/bulk.ts";

const columnHelper = createColumnHelper<BulkPreviewRow>();

interface BulkValidationTableProps {
  rows: BulkPreviewRow[];
  onRemoveRow: (rowNumber: number) => void;
  onUpdateRow: (rowNumber: number, field: string, value: string) => void;
}

export function BulkValidationTable({
  rows,
  onRemoveRow,
  onUpdateRow,
}: BulkValidationTableProps) {
  const columns = [
    columnHelper.accessor("rowNumber", {
      header: "#",
      cell: (info) => (
        <span className="text-sm text-brand-500">{info.getValue()}</span>
      ),
      size: 50,
    }),
    columnHelper.accessor("ticker", {
      header: "Ticker",
      cell: (info) => {
        const row = info.row.original;
        if (!row.valid && row.errors.some((e) => e.toLowerCase().includes("ticker"))) {
          return (
            <input
              type="text"
              defaultValue={row.ticker ?? ""}
              onBlur={(e) =>
                onUpdateRow(row.rowNumber, "ticker", e.target.value)
              }
              className="w-full text-sm border border-error-border rounded px-2 py-1 text-brand-900 bg-white"
            />
          );
        }
        return (
          <span className="text-sm font-medium text-brand-900">
            {info.getValue()}
          </span>
        );
      },
      size: 100,
    }),
    columnHelper.accessor("direction", {
      header: "Direction",
      cell: (info) => {
        const row = info.row.original;
        if (!row.valid && row.errors.some((e) => e.toLowerCase().includes("direction"))) {
          return (
            <select
              defaultValue={row.direction ?? ""}
              onChange={(e) =>
                onUpdateRow(row.rowNumber, "direction", e.target.value)
              }
              className="text-sm border border-error-border rounded px-2 py-1 text-brand-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          );
        }
        return (
          <span className="text-sm text-brand-700 capitalize">
            {info.getValue()}
          </span>
        );
      },
      size: 90,
    }),
    columnHelper.accessor("bullets", {
      header: "Bullets Preview",
      cell: (info) => (
        <span
          className="text-sm text-brand-700 truncate block max-w-[300px]"
          title={info.getValue() ?? ""}
        >
          {info.getValue() || "--"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "issue",
      header: "Issue",
      cell: (info) => {
        const row = info.row.original;
        if (!row.valid && row.errors.length > 0) {
          return (
            <span className="text-sm text-error-text">
              {row.errors.join("; ")}
            </span>
          );
        }
        return null;
      },
      size: 150,
    }),
    columnHelper.display({
      id: "remove",
      header: "",
      cell: (info) => (
        <button
          type="button"
          onClick={() => onRemoveRow(info.row.original.rowNumber)}
          className="text-brand-500 hover:text-error-text transition-colors"
          aria-label={`Remove row ${info.row.original.rowNumber}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ),
      size: 50,
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.rowNumber),
  });

  return (
    <div className="border border-brand-200 rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-brand-50 border-b border-brand-200"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-xs font-medium text-brand-500 uppercase tracking-wider"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={clsx(
                "border-b border-brand-100 last:border-b-0",
                !row.original.valid && "bg-error-bg/50",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
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
