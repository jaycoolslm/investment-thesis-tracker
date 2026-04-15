import * as z from "zod";

export const pillarSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const riskSchema = z.object({
  description: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
});

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().nullable(),
  type: z.enum(["web", "broker_research", "filing", "news"]).nullable(),
});

export const valuationSchema = z.object({
  methodology: z.string().min(1),
  currentPrice: z.number().nullable(),
  upsideCase: z.string().nullable(),
  baseCase: z.string().nullable(),
  downsideCase: z.string().nullable(),
});

export const thesisOutputSchema = z.object({
  summary: z.string().min(10),
  pillars: z.array(pillarSchema).min(2).max(5),
  qualityAssessment: z.string().min(10),
  valuation: valuationSchema,
  assumptions: z.array(z.string().min(1)).min(1),
  risks: z.array(riskSchema).min(1),
  sources: z.array(sourceSchema).min(1),
});

export type ThesisOutput = z.infer<typeof thesisOutputSchema>;
export type Pillar = z.infer<typeof pillarSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Valuation = z.infer<typeof valuationSchema>;

// Phase 2: Weekly monitoring output schema
export const weeklyLogOutputSchema = z.object({
  weekLabel: z.string().min(1),
  weekDate: z.string().date(),
  priceChangePct: z.number().nullable(),
  indexChangePct: z.number().nullable(),
  relativePerf: z.number().nullable(),
  thesisImpact: z.enum(["strengthened", "weakened", "unchanged"]),
  summary: z.string().min(10),
  pillarRefs: z.array(
    z.object({
      pillarId: z.string().uuid(),
      pillarTitle: z.string(),
      impact: z.enum(["strengthened", "weakened", "unchanged"]),
    }),
  ),
  sources: z.array(sourceSchema),
});

export type WeeklyLogOutput = z.infer<typeof weeklyLogOutputSchema>;
