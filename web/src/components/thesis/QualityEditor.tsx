import { useCallback } from "react";
import { EditableText } from "../EditableText.tsx";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";

interface QualityEditorProps {
  thesisId: string;
  initialValue: string | null;
}

export function QualityEditor({ thesisId, initialValue }: QualityEditorProps) {
  const mutation = useUpdateThesis();

  const handleSave = useCallback(
    async (newValue: string) => {
      await mutation.mutateAsync({
        thesisId,
        data: { qualityAssess: newValue },
      });
    },
    [thesisId, mutation],
  );

  return (
    <section>
      <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Quality Assessment
      </h3>
      <div className="bg-surface-card rounded-lg p-6 shadow-sm border border-brand-200">
        <EditableText
          value={initialValue ?? ""}
          onSave={handleSave}
          multiline
          placeholder="Financial strength, competitive position, ESG considerations..."
          className="text-brand-700"
        />
      </div>
    </section>
  );
}
