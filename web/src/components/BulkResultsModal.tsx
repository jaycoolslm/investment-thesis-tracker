import * as Dialog from "@radix-ui/react-dialog";
import type { BulkFailure } from "../api/bulk.ts";

interface BulkResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completed: number;
  failed: number;
  failures: BulkFailure[];
  onRetry: (holdingIds?: string[]) => void;
  isRetrying: boolean;
}

export function BulkResultsModal({
  open,
  onOpenChange,
  completed,
  failed,
  failures,
  onRetry,
  isRetrying,
}: BulkResultsModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[90vw] max-w-xl max-h-[80vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-brand-900 mb-2">
            Import Results
          </Dialog.Title>

          <Dialog.Description className="text-sm text-brand-700 mb-4">
            {completed} succeeded. {failed} failed.
          </Dialog.Description>

          {failures.length > 0 && (
            <>
              <p className="text-sm font-medium text-brand-800 mb-2">
                Failed:
              </p>
              <div className="border border-brand-200 rounded-md overflow-hidden mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-brand-50 border-b border-brand-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-brand-500 uppercase">
                        Ticker
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-brand-500 uppercase">
                        Error
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-brand-500 uppercase w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.map((f) => (
                      <tr
                        key={f.holdingId}
                        className="border-b border-brand-100 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-sm font-medium text-brand-900">
                          {f.ticker}
                        </td>
                        <td className="px-3 py-2 text-sm text-error-text">
                          {f.error}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onRetry([f.holdingId])}
                            disabled={isRetrying}
                            className="text-sm text-accent-600 hover:underline disabled:opacity-50"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3">
            {failures.length > 1 && (
              <button
                type="button"
                onClick={() => onRetry()}
                disabled={isRetrying}
                className="border border-accent-600 text-accent-600 text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-50 transition-colors disabled:opacity-50"
              >
                {isRetrying ? "Retrying..." : "Retry All Failed"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
