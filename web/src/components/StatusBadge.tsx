import clsx from "clsx";

const statusStyles = {
  strengthened: "bg-status-green-100 text-status-green-700",
  weakened: "bg-status-red-100 text-status-red-700",
  unchanged: "bg-status-grey-100 text-status-grey-700",
  generating: "bg-status-blue-100 text-status-blue-700 animate-pulse",
  new: "border border-status-blue-700 text-status-blue-700",
  failed: "bg-error-bg text-error-text",
} as const;

const statusLabels = {
  strengthened: "Strengthened",
  weakened: "Weakened",
  unchanged: "Unchanged",
  generating: "Generating",
  new: "New",
  failed: "Failed",
} as const;

type StatusType = keyof typeof statusStyles;

export function StatusBadge({ status }: { status: StatusType | null }) {
  if (!status) return <span className="text-xs text-brand-500">--</span>;

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
