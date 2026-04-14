import * as Select from "@radix-ui/react-select";
import { updateHolding } from "../../api/client.ts";

const BENCHMARKS = [
  "S&P 500",
  "NASDAQ Composite",
  "FTSE 100",
  "Euro Stoxx 50",
  "Nikkei 225",
  "Hang Seng",
  "ASX 200",
];

interface BenchmarkEditorProps {
  holdingId: string;
  currentBenchmark: string;
  onUpdate: (benchmark: string) => void;
}

export function BenchmarkEditor({
  holdingId,
  currentBenchmark,
  onUpdate,
}: BenchmarkEditorProps) {
  const handleChange = async (value: string) => {
    onUpdate(value);
    await updateHolding(holdingId, { benchmark: value });
  };

  return (
    <Select.Root value={currentBenchmark} onValueChange={handleChange}>
      <Select.Trigger className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-accent-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 rounded">
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
            {BENCHMARKS.map((b) => (
              <Select.Item
                key={b}
                value={b}
                className="text-sm px-3 py-1.5 rounded cursor-pointer outline-none hover:bg-brand-100 data-[highlighted]:bg-brand-100 text-brand-700"
              >
                <Select.ItemText>{b}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
