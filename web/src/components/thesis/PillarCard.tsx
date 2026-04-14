import { useState, useCallback } from "react";
import { EditableText } from "../EditableText.tsx";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import {
  useUpdatePillar,
  useDeletePillar,
} from "../../hooks/useThesisMutations.ts";

interface PillarCardProps {
  thesisId: string;
  pillar: { id: string; title: string; body: string | null; sortOrder: number };
  index: number;
  totalPillars: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function PillarCard({
  thesisId,
  pillar,
  index,
  totalPillars,
  onMoveUp,
  onMoveDown,
}: PillarCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateMutation = useUpdatePillar();
  const deleteMutation = useDeletePillar();

  const handleSaveTitle = useCallback(
    async (newTitle: string) => {
      await updateMutation.mutateAsync({
        thesisId,
        pillarId: pillar.id,
        data: { title: newTitle },
      });
    },
    [thesisId, pillar.id, updateMutation],
  );

  const handleSaveBody = useCallback(
    async (newBody: string) => {
      await updateMutation.mutateAsync({
        thesisId,
        pillarId: pillar.id,
        data: { body: newBody },
      });
    },
    [thesisId, pillar.id, updateMutation],
  );

  const handleDelete = () => {
    deleteMutation.mutate({ thesisId, pillarId: pillar.id });
    setConfirmOpen(false);
  };

  return (
    <div
      className="bg-surface-card rounded-lg p-5 shadow-sm border border-brand-200 group focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-1"
      onKeyDown={(e) => {
        if (e.altKey && e.key === "ArrowUp" && index > 0) {
          e.preventDefault();
          onMoveUp();
        } else if (e.altKey && e.key === "ArrowDown" && index < totalPillars - 1) {
          e.preventDefault();
          onMoveDown();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className="text-xs font-medium text-brand-500 uppercase tracking-wider">
            Pillar {index + 1}
          </span>
          <div className="mt-1">
            <EditableText
              value={pillar.title}
              onSave={handleSaveTitle}
              placeholder="Pillar title"
              className="font-semibold text-brand-900"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-brand-400 hover:text-brand-700 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Move pillar ${index + 1} up`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 4L4 8h3v4h2V8h3L8 4z" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalPillars - 1}
            className="p-1 text-brand-400 hover:text-brand-700 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Move pillar ${index + 1} down`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 12l4-4H9V4H7v4H4l4 4z" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1 text-brand-300 hover:text-status-red-600 transition-colors"
            aria-label={`Delete pillar ${index + 1}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M5 2h6v1H5V2zm-1.5 2h9l-.75 10H5.25L4.5 4H3.5zm2 2v6h1V6h-1zm3 0v6h1V6h-1z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <EditableText
        value={pillar.body ?? ""}
        onSave={handleSaveBody}
        multiline
        placeholder="Describe this pillar..."
        className="text-brand-600"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this pillar?"
        description={`Pillar ${index + 1}: ${pillar.title} will be permanently removed.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
