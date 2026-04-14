import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateThesis,
  createPillar,
  updatePillar,
  deletePillar,
  reorderPillars,
  type ThesisUpdateInput,
} from "../api/client.ts";

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

export function useCreatePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      thesisId,
      data,
    }: {
      thesisId: string;
      data: { title: string; body?: string };
    }) => createPillar(thesisId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thesis"] });
    },
  });
}

export function useUpdatePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      thesisId,
      pillarId,
      data,
    }: {
      thesisId: string;
      pillarId: string;
      data: { title?: string; body?: string };
    }) => updatePillar(thesisId, pillarId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thesis"] });
    },
  });
}

export function useDeletePillar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      thesisId,
      pillarId,
    }: {
      thesisId: string;
      pillarId: string;
    }) => deletePillar(thesisId, pillarId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thesis"] });
    },
  });
}

export function useReorderPillars() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      thesisId,
      pillarIds,
    }: {
      thesisId: string;
      pillarIds: string[];
    }) => reorderPillars(thesisId, pillarIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thesis"] });
    },
  });
}
