import { useState, useEffect, useRef, useCallback } from "react";
import type { Risk } from "../../api/client.ts";
import { SeverityBadge } from "../SeverityBadge.tsx";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import { useAutoSave } from "../../hooks/useAutoSave.ts";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";

interface RisksEditorProps {
  thesisId: string;
  initialRisks: Risk[];
}

export function RisksEditor({ thesisId, initialRisks }: RisksEditorProps) {
  const [items, setItems] = useState(initialRisks);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const mutation = useUpdateThesis();
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

  useEffect(() => {
    setItems(initialRisks);
  }, [initialRisks]);

  const saveFn = useCallback(
    async () => {
      await mutation.mutateAsync({
        thesisId,
        data: { risks: latestItemsRef.current },
      });
    },
    [thesisId, mutation],
  );

  const { save, status } = useAutoSave(saveFn);

  const update = (newItems: Risk[]) => {
    setItems(newItems);
    save("");
  };

  const handleChange = (index: number, field: keyof Risk, value: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    update(next);
  };

  const handleDelete = () => {
    if (deleteIndex === null) return;
    update(items.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
  };

  const handleAdd = () => {
    update([...items, { description: "", severity: "medium" }]);
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider">
          Key Risks
        </h3>
        {status === "saving" && (
          <span className="text-xs text-brand-500">Saving...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-status-green-700">Saved</span>
        )}
      </div>
      <div className="bg-surface-card rounded-lg p-6 shadow-sm border border-brand-200">
        {items.length === 0 && (
          <p className="text-sm text-brand-400">No risks identified.</p>
        )}
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 border-b border-brand-100 last:border-0 group"
          >
            <SeverityBadge
              severity={item.severity}
              editable
              onChange={(s) => handleChange(i, "severity", s)}
            />
            <input
              type="text"
              value={item.description}
              onChange={(e) => handleChange(i, "description", e.target.value)}
              placeholder="Describe risk..."
              className="flex-1 text-sm text-brand-700 bg-transparent outline-none focus:text-brand-900"
            />
            <button
              onClick={() => setDeleteIndex(i)}
              className="text-brand-300 hover:text-status-red-600 opacity-0 group-hover:opacity-100 transition-all"
              aria-label={`Delete risk ${i + 1}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={handleAdd}
          className="mt-3 text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
        >
          + Add Risk
        </button>
      </div>

      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}
        title="Remove this risk?"
        description={
          deleteIndex !== null
            ? `"${items[deleteIndex]?.description || "Untitled risk"}" will be permanently removed.`
            : ""
        }
        onConfirm={handleDelete}
      />
    </section>
  );
}
