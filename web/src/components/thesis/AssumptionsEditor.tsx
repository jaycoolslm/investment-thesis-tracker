import { useState, useEffect, useRef, useCallback } from "react";
import { useAutoSave } from "../../hooks/useAutoSave.ts";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";

interface AssumptionsEditorProps {
  thesisId: string;
  initialAssumptions: string[];
}

export function AssumptionsEditor({
  thesisId,
  initialAssumptions,
}: AssumptionsEditorProps) {
  const [items, setItems] = useState(initialAssumptions);
  const mutation = useUpdateThesis();
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

  // Sync when data refreshes from server
  useEffect(() => {
    setItems(initialAssumptions);
  }, [initialAssumptions]);

  const saveFn = useCallback(
    async () => {
      await mutation.mutateAsync({
        thesisId,
        data: { assumptions: latestItemsRef.current },
      });
    },
    [thesisId, mutation],
  );

  const { save, status } = useAutoSave(saveFn);

  const update = (newItems: string[]) => {
    setItems(newItems);
    save(""); // trigger is the items ref, value arg unused
  };

  const handleChange = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    update(next);
  };

  const handleDelete = (index: number) => {
    update(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    update([...items, ""]);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider">
          Key Assumptions
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
          <p className="text-sm text-brand-400">No assumptions yet.</p>
        )}
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-2 border-b border-brand-100 last:border-0 group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
            <input
              type="text"
              value={item}
              onChange={(e) => handleChange(i, e.target.value)}
              placeholder="Describe assumption..."
              className="flex-1 text-sm text-brand-700 bg-transparent outline-none focus:text-brand-900"
            />
            <button
              onClick={() => handleDelete(i)}
              className="text-brand-300 hover:text-status-red-600 opacity-0 group-hover:opacity-100 transition-all"
              aria-label={`Delete assumption ${i + 1}`}
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
          + Add Assumption
        </button>
      </div>
    </section>
  );
}
