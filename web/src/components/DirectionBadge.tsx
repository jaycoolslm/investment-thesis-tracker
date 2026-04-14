import clsx from "clsx";

const directionStyles = {
  long: "bg-status-green-100 text-status-green-700",
  short: "bg-status-grey-100 text-status-grey-700",
} as const;

export function DirectionBadge({ direction }: { direction: "long" | "short" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium capitalize",
        directionStyles[direction],
      )}
    >
      {direction}
    </span>
  );
}
