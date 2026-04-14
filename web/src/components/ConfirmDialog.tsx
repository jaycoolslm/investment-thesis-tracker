import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Remove",
  cancelLabel = "Keep",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-fade-in" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[420px] max-w-[90vw] focus:outline-none">
          <AlertDialog.Title className="text-base font-semibold text-brand-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-brand-600">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-3">
            <AlertDialog.Cancel className="px-4 py-2 text-sm font-medium text-brand-700 bg-brand-100 hover:bg-brand-200 rounded-md transition-colors">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-status-red-700 hover:bg-red-800 rounded-md transition-colors"
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
