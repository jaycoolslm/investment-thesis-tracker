import { useState } from "react";
import { FileDropZone } from "../FileDropZone.tsx";
import { ConfirmDialog } from "../ConfirmDialog.tsx";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "../../hooks/useDocuments.ts";

interface BrokerResearchPanelProps {
  holdingId: string;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function BrokerResearchPanel({ holdingId }: BrokerResearchPanelProps) {
  const { data: documents } = useDocuments(holdingId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    filename: string;
  } | null>(null);

  const handleFilesSelected = (files: File[]) => {
    for (const file of files) {
      uploadMutation.mutate({ holdingId, file });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ holdingId, documentId: deleteTarget.id });
    setDeleteTarget(null);
  };

  return (
    <section className="mt-8">
      <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Broker Research
      </h3>

      {/* File list */}
      {documents && documents.length > 0 && (
        <div className="bg-surface-card rounded-lg shadow-sm border border-brand-200 mb-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-brand-100 last:border-0 group"
            >
              <span className="text-brand-400">
                {doc.fileType === "PDF" ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="1" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="1" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 8h6M7 11h6" stroke="currentColor" strokeWidth="1" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium text-brand-900 truncate max-w-[300px]">
                {doc.filename}
              </span>
              <span className="text-xs text-brand-500">
                {formatFileSize(doc.fileSize)}
              </span>
              <span className="text-xs text-brand-500">
                Uploaded {formatDate(doc.createdAt)}
              </span>
              <button
                onClick={() =>
                  setDeleteTarget({ id: doc.id, filename: doc.filename })
                }
                className="ml-auto text-brand-300 hover:text-status-red-600 opacity-0 group-hover:opacity-100 transition-all"
                aria-label={`Delete ${doc.filename}`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M5 2h6v1H5V2zm-1.5 2h9l-.75 10H5.25L4.5 4H3.5zm2 2v6h1V6h-1zm3 0v6h1V6h-1z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {documents && documents.length === 0 && (
        <p className="text-sm text-brand-400 mb-4">
          No research uploaded for this holding. Upload broker PDFs or reports to
          improve thesis quality and weekly analysis.
        </p>
      )}

      {/* Upload zone */}
      <FileDropZone
        files={[]}
        onChange={(files) => handleFilesSelected(files)}
      />

      {uploadMutation.isPending && (
        <div className="mt-2">
          <div className="h-1.5 bg-brand-200 rounded-full overflow-hidden">
            <div className="h-full bg-accent-600 rounded-full animate-pulse w-2/3" />
          </div>
          <p className="text-xs text-brand-500 mt-1">Uploading...</p>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove this file?"
        description={`${deleteTarget?.filename ?? "This file"} will no longer be used in weekly analysis.`}
        onConfirm={handleDelete}
      />
    </section>
  );
}
