import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FileDropZone } from "./FileDropZone.tsx";
import { BulkValidationTable } from "./BulkValidationTable.tsx";
import { useBulkUpload } from "../hooks/useBulkUpload.ts";
import { downloadTemplate, type BulkPreviewRow } from "../api/bulk.ts";

const BULK_ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartGeneration: (batchId: string, excludeRows: number[]) => void;
}

export function BulkUploadModal({
  open,
  onOpenChange,
  onStartGeneration,
}: BulkUploadModalProps) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkPreviewRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const uploadMutation = useBulkUpload();

  function handleFilesChange(newFiles: File[]) {
    setFiles(newFiles);
    if (newFiles.length > 0) {
      uploadMutation.mutate(newFiles[0], {
        onSuccess: (preview) => {
          setBatchId(preview.batchId);
          setRows(preview.rows);
          setStep("preview");
        },
      });
    }
  }

  function handleRemoveRow(rowNumber: number) {
    setRows((prev) => prev.filter((r) => r.rowNumber !== rowNumber));
  }

  function handleUpdateRow(rowNumber: number, field: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        const updated = { ...r, [field]: value };
        // Re-validate: check if all required fields are now present
        const errors: string[] = [];
        if (!updated.ticker) errors.push("Missing ticker");
        if (!updated.direction || !["long", "short"].includes(updated.direction))
          errors.push("Direction must be Long or Short");
        if (!updated.bullets) errors.push("No thesis bullets provided");
        return { ...updated, valid: errors.length === 0, errors };
      }),
    );
  }

  function handleGenerate() {
    if (!batchId) return;
    const errorRows = rows.filter((r) => !r.valid).map((r) => r.rowNumber);
    onStartGeneration(batchId, errorRows);
    handleClose();
  }

  function handleClose() {
    setStep("upload");
    setBatchId(null);
    setRows([]);
    setFiles([]);
    uploadMutation.reset();
    onOpenChange(false);
  }

  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[90vw] ${
            step === "preview" ? "max-w-3xl" : "max-w-lg"
          } max-h-[85vh] overflow-y-auto`}
        >
          <Dialog.Title className="text-lg font-semibold text-brand-900 mb-1">
            Import Holdings from Spreadsheet
          </Dialog.Title>

          {step === "upload" && (
            <>
              <Dialog.Description className="text-sm text-brand-500 mb-4">
                Upload an Excel (.xlsx) or CSV file with your holdings. Each row
                becomes a thesis.
                <br />
                Required columns: Ticker, Direction (Long or Short), Thesis
                Bullets
              </Dialog.Description>

              <button
                type="button"
                onClick={downloadTemplate}
                className="text-sm text-accent-600 hover:text-accent-700 font-medium mb-4 block"
              >
                Download Template
              </button>

              <FileDropZone
                files={files}
                onChange={handleFilesChange}
                accept=".xlsx,.csv"
                acceptedTypes={BULK_ACCEPTED_TYPES}
                maxSize={5 * 1024 * 1024}
                multiple={false}
                dropLabel="Drop your spreadsheet here, or"
                hintLabel="Excel (.xlsx) or CSV, up to 5 MB"
              />

              {uploadMutation.isPending && (
                <p className="text-sm text-brand-500 mt-3 animate-pulse">
                  Reviewing your file...
                </p>
              )}

              {uploadMutation.isError && (
                <p className="text-sm text-error-text mt-3">
                  {uploadMutation.error.message}
                </p>
              )}
            </>
          )}

          {step === "preview" && (
            <>
              <Dialog.Description className="text-sm mb-4">
                {errorCount === 0 ? (
                  <span className="text-status-green-700">
                    {validCount} holdings found. Ready to generate.
                  </span>
                ) : (
                  <span className="text-warning-text">
                    {rows.length} rows found. {errorCount} need attention.
                    <br />
                    <span className="text-brand-500">
                      Rows with errors are highlighted. Fix them below or remove
                      them to continue.
                    </span>
                  </span>
                )}
              </Dialog.Description>

              <BulkValidationTable
                rows={rows}
                onRemoveRow={handleRemoveRow}
                onUpdateRow={handleUpdateRow}
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-sm text-brand-700 hover:text-brand-900 px-4 py-2 transition-colors"
                >
                  Cancel
                </button>

                {validCount > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
                  >
                    {errorCount > 0
                      ? `Skip Errors and Generate ${validCount}`
                      : `Generate All`}
                  </button>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
