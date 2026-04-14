import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
} from "../api/client.ts";

export function useDocuments(holdingId: string) {
  return useQuery({
    queryKey: ["documents", holdingId],
    queryFn: () => getDocuments(holdingId),
    enabled: !!holdingId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      holdingId,
      file,
    }: {
      holdingId: string;
      file: File;
    }) => uploadDocument(holdingId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["documents", variables.holdingId],
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      holdingId,
      documentId,
    }: {
      holdingId: string;
      documentId: string;
    }) => deleteDocument(holdingId, documentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["documents", variables.holdingId],
      });
    },
  });
}
