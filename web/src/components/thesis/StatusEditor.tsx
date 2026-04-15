import * as Select from "@radix-ui/react-select";
import clsx from "clsx";
import { updateHolding } from "../../api/client.ts";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "paused", label: "Paused" },
] as const;

function statusStyle(status: string) {
  switch (status) {
    case "active":
      return "text-status-green-600";
    case "closed":
      return "text-brand-400";
    case "paused":
      return "text-status-amber-600";
    default:
      return "text-brand-500";
  }
}

interface StatusEditorProps {
  holdingId: string;
  currentStatus: "active" | "closed" | "paused";
  onUpdate: (status: "active" | "closed" | "paused") => void;
}

export function StatusEditor({
  holdingId,
  currentStatus,
  onUpdate,
}: StatusEditorProps) {
  const handleChange = async (value: string) => {
    const status = value as "active" | "closed" | "paused";
    onUpdate(status);
    await updateHolding(holdingId, { status });
  };

  return (
    <Select.Root value={currentStatus} onValueChange={handleChange}>
      <Select.Trigger
        className={clsx(
          "inline-flex items-center gap-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 rounded",
          statusStyle(currentStatus),
        )}
      >
        <Select.Value />
        <Select.Icon>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="bg-white border border-brand-200 rounded-md shadow-lg p-1 z-50"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport>
            {STATUSES.map((s) => (
              <Select.Item
                key={s.value}
                value={s.value}
                className="text-sm px-3 py-1.5 rounded cursor-pointer outline-none hover:bg-brand-100 data-[highlighted]:bg-brand-100 text-brand-700"
              >
                <Select.ItemText>{s.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
