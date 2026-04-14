import { useMutation } from "@tanstack/react-query";
import { uploadBulkFile, type BulkPreview } from "../api/bulk.ts";

export function useBulkUpload() {
  return useMutation<BulkPreview, Error, File>({
    mutationFn: uploadBulkFile,
  });
}
