import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createHolding,
  uploadDocument,
  type CreateHoldingInput,
} from "../api/client.ts";

export interface GenerateThesisInput {
  holding: CreateHoldingInput;
  bullets: string;
  files: File[];
}

export interface PreparedGeneration {
  holdingId: string;
  ticker: string;
  bullets: string;
  hasDocuments: boolean;
}

export function useGenerateThesis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateThesisInput): Promise<PreparedGeneration> => {
      // 1. Create the holding (fast)
      const holding = await createHolding(input.holding);

      // 2. Upload files if any (fast)
      for (const file of input.files) {
        await uploadDocument(holding.id, file);
      }

      // Return — generation is NOT triggered here
      return {
        holdingId: holding.id,
        ticker: input.holding.ticker,
        bullets: input.bullets,
        hasDocuments: input.files.length > 0,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}
