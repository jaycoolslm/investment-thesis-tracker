import { useState, useEffect, useRef, useCallback } from "react";
import type { Valuation } from "../../api/client.ts";
import { useAutoSave } from "../../hooks/useAutoSave.ts";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";

interface ValuationEditorProps {
  thesisId: string;
  initialValue: Valuation | null;
}

const fields: { key: keyof Valuation; label: string; readonly?: boolean }[] = [
  { key: "methodology", label: "Methodology" },
  { key: "currentPrice", label: "Current Price", readonly: true },
  { key: "upsideCase", label: "Upside Case" },
  { key: "baseCase", label: "Base Case" },
  { key: "downsideCase", label: "Downside Case" },
];

const defaultValuation: Valuation = {
  methodology: "",
  currentPrice: null,
  upsideCase: null,
  baseCase: null,
  downsideCase: null,
};

export function ValuationEditor({
  thesisId,
  initialValue,
}: ValuationEditorProps) {
  const [val, setVal] = useState<Valuation>(initialValue ?? defaultValuation);
  const mutation = useUpdateThesis();
  const latestRef = useRef(val);
  latestRef.current = val;

  useEffect(() => {
    setVal(initialValue ?? defaultValuation);
  }, [initialValue]);

  const saveFn = useCallback(
    async () => {
      await mutation.mutateAsync({
        thesisId,
        data: { valuation: latestRef.current },
      });
    },
    [thesisId, mutation],
  );

  const { save, status } = useAutoSave(saveFn);

  const handleChange = (key: keyof Valuation, value: string) => {
    const next = { ...val, [key]: value };
    setVal(next);
    save("");
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider">
          Valuation & Expected Return
        </h3>
        {status === "saving" && (
          <span className="text-xs text-brand-500">Saving...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-status-green-700">Saved</span>
        )}
      </div>
      <div className="bg-surface-card rounded-lg p-6 shadow-sm border border-brand-200">
        <dl>
          {fields.map(({ key, label, readonly }) => (
            <div
              key={key}
              className="flex gap-4 py-2 border-b border-brand-100 last:border-0"
            >
              <dt className="text-sm font-medium text-brand-500 w-[160px] shrink-0">
                {label}
              </dt>
              <dd className="text-sm text-brand-700 flex-1">
                {readonly ? (
                  <span className="font-mono tabular-nums">
                    {val.currentPrice != null ? `$${val.currentPrice}` : "--"}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={(val[key] as string) ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()}...`}
                    className="w-full bg-transparent outline-none focus:text-brand-900"
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
