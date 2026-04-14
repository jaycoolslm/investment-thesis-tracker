import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { FileDropZone } from "./FileDropZone.tsx";

const BENCHMARKS = [
  "S&P 500",
  "NASDAQ",
  "FTSE 100",
  "Euro Stoxx 50",
  "Nikkei 225",
  "Hang Seng",
  "ASX 200",
];

export interface AddHoldingFormData {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmark: string;
  bullets: string;
  files: File[];
}

interface AddHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddHoldingFormData) => void;
  isSubmitting?: boolean;
}

export function AddHoldingModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: AddHoldingModalProps) {
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [benchmark, setBenchmark] = useState("S&P 500");
  const [bullets, setBullets] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const canSubmit =
    ticker.trim().length > 0 &&
    companyName.trim().length > 0 &&
    bullets.trim().length > 0 &&
    !isSubmitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      ticker: ticker.trim().toUpperCase(),
      companyName: companyName.trim(),
      direction,
      benchmark,
      bullets: bullets.trim(),
      files,
    });
  }

  function resetForm() {
    setTicker("");
    setCompanyName("");
    setDirection("long");
    setBenchmark("S&P 500");
    setBullets("");
    setFiles([]);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 focus:outline-none">
          <Dialog.Title className="text-lg font-semibold text-brand-900 mb-4">
            Add Holding
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ticker */}
            <div>
              <label
                htmlFor="ticker"
                className="block text-sm font-medium text-brand-700 mb-1"
              >
                Ticker
              </label>
              <input
                id="ticker"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. AAPL, SHEL.L"
                className="w-full border border-brand-200 rounded-md px-3 py-2 text-sm text-brand-900 placeholder:text-brand-500 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent"
              />
            </div>

            {/* Company Name */}
            <div>
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-brand-700 mb-1"
              >
                Company Name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apple Inc."
                className="w-full border border-brand-200 rounded-md px-3 py-2 text-sm text-brand-900 placeholder:text-brand-500 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent"
              />
            </div>

            {/* Direction toggle */}
            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">
                Position
              </label>
              <ToggleGroup.Root
                type="single"
                value={direction}
                onValueChange={(v) => {
                  if (v) setDirection(v as "long" | "short");
                }}
                className="flex gap-1 bg-brand-100 rounded-md p-1"
              >
                <ToggleGroup.Item
                  value="long"
                  className="flex-1 text-sm font-medium px-3 py-1.5 rounded transition-colors data-[state=on]:bg-white data-[state=on]:text-accent-700 data-[state=on]:shadow-sm data-[state=off]:text-brand-500"
                >
                  Long
                </ToggleGroup.Item>
                <ToggleGroup.Item
                  value="short"
                  className="flex-1 text-sm font-medium px-3 py-1.5 rounded transition-colors data-[state=on]:bg-white data-[state=on]:text-accent-700 data-[state=on]:shadow-sm data-[state=off]:text-brand-500"
                >
                  Short
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </div>

            {/* Benchmark dropdown */}
            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">
                Benchmark Index
              </label>
              <Select.Root value={benchmark} onValueChange={setBenchmark}>
                <Select.Trigger className="w-full flex items-center justify-between border border-brand-200 rounded-md px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent">
                  <Select.Value />
                  <Select.Icon className="text-brand-500">
                    <ChevronDown />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    position="popper"
                    sideOffset={4}
                    className="bg-white border border-brand-200 rounded-md shadow-lg overflow-hidden z-50"
                    style={{
                      width: "var(--radix-select-trigger-width)",
                      maxHeight: "var(--radix-select-content-available-height)",
                    }}
                  >
                    <Select.Viewport>
                      {BENCHMARKS.map((b) => (
                        <Select.Item
                          key={b}
                          value={b}
                          className="flex items-center px-3 py-2 text-sm text-brand-900 cursor-pointer outline-none data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-700"
                        >
                          <Select.ItemText>{b}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto text-accent-600">
                            <CheckIcon />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Thesis bullets */}
            <div>
              <label
                htmlFor="bullets"
                className="block text-sm font-medium text-brand-700 mb-1"
              >
                Thesis Bullets
              </label>
              <textarea
                id="bullets"
                value={bullets}
                onChange={(e) => setBullets(e.target.value)}
                rows={5}
                placeholder={`Write your key arguments for this position, one per line.\n\nExample:\nStrong pricing power — raised prices 8% with no volume loss\nMarket share gains of 3pp in Q1, driven by new product launch\nFCF yield of 8% supports aggressive buyback program`}
                className="w-full border border-brand-200 rounded-md px-3 py-2 text-sm text-brand-900 placeholder:text-brand-500 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-transparent resize-y"
              />
              <p className="text-xs text-brand-500 mt-1">
                The more specific you are, the better the generated thesis.
              </p>
            </div>

            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-brand-700 mb-1">
                Broker Research (optional)
              </label>
              <FileDropZone files={files} onChange={setFiles} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-sm font-medium text-brand-500 hover:text-brand-700 px-4 py-2 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!canSubmit}
                className="bg-accent-600 hover:bg-accent-700 disabled:bg-brand-200 disabled:text-brand-500 text-white text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors"
              >
                {isSubmitting ? "Generating..." : "Generate Thesis"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 8L6.5 11.5L13 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
