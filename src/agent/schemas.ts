import * as z from "zod";

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().nullable(),
});

export const thesisOutputSchema = z.object({
  content: z.string().min(200),
  sources: z.array(sourceSchema).min(1),
});

export type ThesisOutput = z.infer<typeof thesisOutputSchema>;
export type Source = z.infer<typeof sourceSchema>;

// Phase 2: Weekly monitoring output schema
export const weeklyLogOutputSchema = z.object({
  weekLabel: z.string().min(1),
  weekDate: z.string().date(),
  priceChangePct: z.number().nullable(),
  indexChangePct: z.number().nullable(),
  relativePerf: z.number().nullable(),
  thesisImpact: z.enum(["strengthened", "weakened", "unchanged"]),
  summary: z.string().min(10),
  sources: z.array(sourceSchema),
});

export type WeeklyLogOutput = z.infer<typeof weeklyLogOutputSchema>;
