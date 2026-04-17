import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { weeklyLogs, holdings } from "../db/schema.js";
import { config } from "../config.js";
import {
  buildDigestHtml,
  buildDigestSubject,
  type DigestHolding,
} from "./email-template.js";

export class EmailService {
  private transport: Transporter | null;

  constructor(transport?: Transporter) {
    if (transport) {
      this.transport = transport;
    } else if (config.SMTP_HOST) {
      this.transport = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT ?? 587,
        secure: config.SMTP_PORT === 465,
        auth:
          config.SMTP_USER && config.SMTP_PASS
            ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
            : undefined,
      });
    } else {
      this.transport = null;
    }
  }

  async sendWeeklyDigest(weekLabel: string): Promise<void> {
    if (!this.transport) {
      console.warn(
        "[email] SMTP not configured — skipping weekly digest. Set SMTP_HOST to enable.",
      );
      return;
    }

    if (!config.EMAIL_TO) {
      console.warn("[email] EMAIL_TO not set — skipping weekly digest.");
      return;
    }

    // Query weekly logs for this week, joined with holdings
    const rows = await db
      .select({
        holdingId: holdings.id,
        ticker: holdings.ticker,
        companyName: holdings.companyName,
        priceChangePct: weeklyLogs.priceChangePct,
        indexChangePct: weeklyLogs.indexChangePct,
        thesisImpact: weeklyLogs.thesisImpact,
        summary: weeklyLogs.summary,
        weekDate: weeklyLogs.weekDate,
      })
      .from(weeklyLogs)
      .innerJoin(holdings, eq(weeklyLogs.holdingId, holdings.id))
      .where(eq(weeklyLogs.weekLabel, weekLabel));

    if (rows.length === 0) {
      console.log("[email] No weekly logs found — skipping digest.");
      return;
    }

    const digestHoldings: DigestHolding[] = rows.map((r) => ({
      holdingId: r.holdingId,
      ticker: r.ticker,
      companyName: r.companyName,
      priceChangePct: r.priceChangePct,
      indexChangePct: r.indexChangePct,
      thesisImpact: r.thesisImpact ?? "unchanged",
      summary: r.summary,
    }));

    const strengthened = rows.filter(
      (r) => r.thesisImpact === "strengthened",
    ).length;
    const weakened = rows.filter(
      (r) => r.thesisImpact === "weakened",
    ).length;
    const unchanged = rows.filter(
      (r) => r.thesisImpact === "unchanged",
    ).length;

    const weekDate = rows[0].weekDate ?? weekLabel;
    const subject = buildDigestSubject(weekDate);
    const html = buildDigestHtml({
      weekDate,
      total: rows.length,
      strengthened,
      weakened,
      unchanged,
      holdings: digestHoldings,
      appUrl: config.APP_URL,
    });

    const info = await this.transport.sendMail({
      from: config.EMAIL_FROM ?? "Thesis Tracker <noreply@example.com>",
      to: config.EMAIL_TO,
      subject,
      html,
    });

    console.log(`[email] Digest sent: messageId=${info.messageId}`);
  }
}
