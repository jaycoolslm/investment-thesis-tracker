import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateThesis, type ThesisUpdateInput } from "../api/client.ts";

export function useUpdateThesis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      thesisId,
      data,
    }: {
      thesisId: string;
      data: ThesisUpdateInput;
    }) => updateThesis(thesisId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thesis"] });
    },
  });
}
