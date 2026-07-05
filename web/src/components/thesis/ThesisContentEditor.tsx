import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";
import { useAutoSave } from "../../hooks/useAutoSave.ts";

interface ThesisContentEditorProps {
  thesisId: string;
  initialValue: string | null;
}

export function ThesisContentEditor({
  thesisId,
  initialValue,
}: ThesisContentEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const mutation = useUpdateThesis();

  const saveFn = useCallback(
    async (content: string) => {
      await mutation.mutateAsync({ thesisId, data: { content } });
    },
    [thesisId, mutation],
  );

  const { save, saveImmediately, status } = useAutoSave(saveFn);

  const handleChange = (next: string) => {
    setValue(next);
    if (next.trim().length > 0) {
      save(next);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider">
          Thesis
        </h3>
        <div className="flex items-center gap-2">
          {status === "saving" && (
            <span className="text-xs text-brand-500">Saving…</span>
          )}
          {status === "saved" && (
            <span className="text-xs text-status-green-700">Saved</span>
          )}
          {status === "error" && (
            <span className="text-xs text-status-red-700">Failed to save</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (editing && value.trim().length > 0) {
                saveImmediately(value);
              }
              setEditing((e) => !e);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-700 bg-white border border-brand-200 rounded hover:bg-brand-50 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Thesis markdown"
          spellCheck={false}
          className="w-full min-h-[32rem] font-mono text-sm text-brand-900 border border-accent-300 rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-1 resize-y"
          placeholder="Write the thesis in Markdown…"
        />
      ) : value.trim().length === 0 ? (
        <p className="text-sm text-brand-400">
          No thesis content yet. Click Edit to write one.
        </p>
      ) : (
        <div className="markdown-body text-sm text-brand-800 leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}
