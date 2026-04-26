import { renderToBuffer } from '@react-pdf/renderer';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { holdings, theses, thesisPillars, weeklyLogs } from '../db/schema.js';
import { ThesisPdf } from '../pdf/ThesisPdf.js';
import type { Pillar, Risk, Source, Valuation } from '../agent/schemas.js';
import type { WeeklyLogRow } from '../pdf/components/WeeklyLogTablePdf.js';

export class HoldingNotFoundError extends Error {
  constructor(holdingId: string) {
    super(`Holding ${holdingId} not found`);
    this.name = 'HoldingNotFoundError';
  }
}

export class NoThesisError extends Error {
  constructor(holdingId: string) {
    super(`No thesis found for holding ${holdingId}`);
    this.name = 'NoThesisError';
  }
}

export async function exportThesisPdf(holdingId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const [holding] = await db
    .select()
    .from(holdings)
    .where(eq(holdings.id, holdingId));

  if (!holding) {
    throw new HoldingNotFoundError(holdingId);
  }

  const [thesis] = await db
    .select()
    .from(theses)
    .where(eq(theses.holdingId, holdingId))
    .orderBy(desc(theses.createdAt))
    .limit(1);

  if (!thesis) {
    throw new NoThesisError(holdingId);
  }

  const pillars = await db
    .select()
    .from(thesisPillars)
    .where(eq(thesisPillars.thesisId, thesis.id))
    .orderBy(asc(thesisPillars.sortOrder));

  const logs = await db
    .select()
    .from(weeklyLogs)
    .where(eq(weeklyLogs.holdingId, holdingId))
    .orderBy(desc(weeklyLogs.weekDate));

  const generatedAt = new Date();

  const buffer = await renderToBuffer(
    <ThesisPdf
      holding={{
        ticker: holding.ticker,
        companyName: holding.companyName,
        direction: holding.direction,
        benchmark: holding.benchmark,
        status: holding.status,
      }}
      thesis={{
        summary: thesis.summary,
        qualityAssess: thesis.qualityAssess,
        valuation: thesis.valuation as Valuation | null,
        assumptions: thesis.assumptions as string[] | null,
        risks: thesis.risks as Risk[] | null,
        sources: thesis.sources as Source[] | null,
      }}
      pillars={pillars.map((p) => ({
        title: p.title,
        body: p.body ?? '',
      })) as Array<Pick<Pillar, 'title' | 'body'>>}
      weeklyLogs={logs.map((log): WeeklyLogRow => ({
        weekLabel: log.weekLabel,
        weekDate: log.weekDate,
        priceChangePct: log.priceChangePct,
        indexChangePct: log.indexChangePct,
        relativePerf: log.relativePerf,
        thesisImpact: log.thesisImpact,
        summary: log.summary,
        pillarRefs: log.pillarRefs as WeeklyLogRow['pillarRefs'],
      }))}
      generatedAt={generatedAt}
    />,
  );

  const datePart = generatedAt.toISOString().slice(0, 10);
  const safeTicker = holding.ticker.replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `${safeTicker}-thesis-${datePart}.pdf`;

  return { buffer, filename };
}
