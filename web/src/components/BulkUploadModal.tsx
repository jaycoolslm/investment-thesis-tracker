import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { FileDropZone } from "./FileDropZone.tsx";
import { useBulkUpload } from "../hooks/useBulkUpload.ts";
import { downloadTemplate, type BulkPreviewRow } from "../api/bulk.ts";

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
            Import Holdings from CSV
          </Dialog.Title>

          {step === "upload" && (
            <>
              <Dialog.Description className="text-sm text-brand-500 mb-4">
                Upload a CSV file with your holdings. Each row becomes a
                thesis. In Excel, use File &rarr; Save As and pick CSV.
                <br />
                Required columns: Ticker, Direction (Long or Short), Thesis
                Bullets
              </Dialog.Description>

              <button
                type="button"
                onClick={downloadTemplate}
                className="text-sm text-accent-600 hover:text-accent-700 font-medium mb-4 block"
              >
                Download CSV Template
              </button>

              <FileDropZone
                files={files}
                onChange={handleFilesChange}
                accept=".csv"
                maxSize={5 * 1024 * 1024}
                multiple={false}
                dropLabel="Drop your CSV file here, or"
                hintLabel="CSV only, up to 5 MB (export from Excel with Save As)"
                typeErrorMessage="Only CSV files are supported. In Excel, choose File → Save As and select CSV, then upload that file."
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
                    {rows.length} rows found. {errorCount} with errors will be
                    skipped.
                    <br />
                    <span className="text-brand-500">
                      Rows with errors are highlighted below. Continue with the{" "}
                      {validCount} valid {validCount === 1 ? "row" : "rows"},
                      or fix the file in your spreadsheet and upload it again.
                    </span>
                  </span>
                )}
              </Dialog.Description>

              <div className="border border-brand-200 rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr className="bg-brand-50 border-b border-brand-200">
                      {["#", "Ticker", "Direction", "Bullets Preview", "Issue"].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left text-xs font-medium text-brand-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={clsx(
                          "border-b border-brand-100 last:border-b-0",
                          !row.valid && "bg-error-bg/50",
                        )}
                      >
                        <td className="px-3 py-2 text-sm text-brand-500">
                          {row.rowNumber}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-brand-900">
                          {row.ticker || "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-brand-700 capitalize">
                          {row.direction || "--"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="text-sm text-brand-700 truncate block max-w-[300px]"
                            title={row.bullets ?? ""}
                          >
                            {row.bullets || "--"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-error-text">
                          {!row.valid && row.errors.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                      ? `Generate ${validCount} valid ${validCount === 1 ? "holding" : "holdings"}`
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
