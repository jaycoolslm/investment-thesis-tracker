import { useCallback } from "react";
import type { ThesisPillar } from "../../api/client.ts";
import { PillarCard } from "./PillarCard.tsx";
import {
  useCreatePillar,
  useReorderPillars,
} from "../../hooks/useThesisMutations.ts";

interface PillarEditorProps {
  thesisId: string;
  pillars: ThesisPillar[];
}

export function PillarEditor({ thesisId, pillars }: PillarEditorProps) {
  const createMutation = useCreatePillar();
  const reorderMutation = useReorderPillars();

  const handleAdd = () => {
    createMutation.mutate({
      thesisId,
      data: { title: "New Pillar" },
    });
  };

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const ids = pillars.map((p) => p.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);
      reorderMutation.mutate({ thesisId, pillarIds: ids });
    },
    [thesisId, pillars, reorderMutation],
  );

  return (
    <section className="mt-8">
      <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Thesis Pillars
      </h3>
      <div className="space-y-4">
        {pillars.map((pillar, i) => (
          <PillarCard
            key={pillar.id}
            thesisId={thesisId}
            pillar={pillar}
            index={i}
            totalPillars={pillars.length}
            onMoveUp={() => handleReorder(i, i - 1)}
            onMoveDown={() => handleReorder(i, i + 1)}
          />
        ))}
      </div>
      {pillars.length < 5 && (
        <button
          onClick={handleAdd}
          disabled={createMutation.isPending}
          className="mt-4 text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors disabled:opacity-50"
        >
          + Add Pillar
        </button>
      )}
    </section>
  );
}
