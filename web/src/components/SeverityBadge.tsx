import * as Select from "@radix-ui/react-select";
import clsx from "clsx";

type Severity = "high" | "medium" | "low";

const severityStyles: Record<Severity, string> = {
  high: "text-status-red-700 bg-status-red-100",
  medium: "text-yellow-700 bg-yellow-100",
  low: "text-status-green-700 bg-status-green-100",
};

const severityLabels: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface SeverityBadgeProps {
  severity: Severity;
  editable?: boolean;
  onChange?: (severity: Severity) => void;
}

export function SeverityBadge({
  severity,
  editable = false,
  onChange,
}: SeverityBadgeProps) {
  const badge = (
    <span
      className={clsx(
        "text-xs font-medium px-2 py-0.5 rounded-sm inline-block",
        severityStyles[severity],
        editable && "cursor-pointer",
      )}
    >
      {severityLabels[severity]}
    </span>
  );

  if (!editable || !onChange) return badge;

  return (
    <Select.Root value={severity} onValueChange={(v) => onChange(v as Severity)}>
      <Select.Trigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 rounded-sm">
        <Select.Value>{badge}</Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="bg-white border border-brand-200 rounded-md shadow-lg p-1 z-50"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            {(["high", "medium", "low"] as Severity[]).map((s) => (
              <Select.Item
                key={s}
                value={s}
                className="text-xs px-3 py-1.5 rounded cursor-pointer outline-none hover:bg-brand-100 data-[highlighted]:bg-brand-100"
              >
                <Select.ItemText>
                  <span className={clsx("font-medium px-2 py-0.5 rounded-sm", severityStyles[s])}>
                    {severityLabels[s]}
                  </span>
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
