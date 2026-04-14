import { useCallback } from "react";
import { EditableText } from "../EditableText.tsx";
import { useUpdateThesis } from "../../hooks/useThesisMutations.ts";

interface SummaryEditorProps {
  thesisId: string;
  initialValue: string | null;
}

export function SummaryEditor({ thesisId, initialValue }: SummaryEditorProps) {
  const mutation = useUpdateThesis();

  const handleSave = useCallback(
    async (newValue: string) => {
      await mutation.mutateAsync({ thesisId, data: { summary: newValue } });
    },
    [thesisId, mutation],
  );

  return (
    <section>
      <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Investment Thesis
      </h3>
      <EditableText
        value={initialValue ?? ""}
        onSave={handleSave}
        multiline
        placeholder="Investment thesis summary"
        className="text-brand-700"
      />
    </section>
  );
}
