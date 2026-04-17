export interface DigestHolding {
  holdingId: string;
  ticker: string;
  companyName: string;
  priceChangePct: string | null;
  indexChangePct: string | null;
  thesisImpact: string;
  summary: string | null;
}

export interface DigestData {
  weekDate: string;
  total: number;
  strengthened: number;
  weakened: number;
  unchanged: number;
  holdings: DigestHolding[];
  appUrl: string;
}

function formatPct(val: string | null): string {
  if (val == null) return "\u2014";
  const num = parseFloat(val);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function impactColor(impact: string): string {
  switch (impact) {
    case "strengthened":
      return "#16a34a";
    case "weakened":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function impactBgColor(impact: string): string {
  switch (impact) {
    case "strengthened":
      return "#f0fdf4";
    case "weakened":
      return "#fef2f2";
    default:
      return "#f9fafb";
  }
}

function pctColor(val: string | null): string {
  if (val == null) return "#6b7280";
  const num = parseFloat(val);
  if (num > 0) return "#16a34a";
  if (num < 0) return "#dc2626";
  return "#6b7280";
}

export function buildDigestSubject(weekDate: string): string {
  const date = new Date(weekDate);
  const formatted = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `Weekly Thesis Update \u2014 ${formatted}`;
}

export function buildDigestHtml(data: DigestData): string {
  const holdingRows = data.holdings
    .map(
      (h) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <a href="${data.appUrl}/holdings/${h.holdingId}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${h.ticker}</a>
          <div style="color: #6b7280; font-size: 12px;">${h.companyName}</div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'JetBrains Mono', monospace; color: ${pctColor(h.priceChangePct)};">
          ${formatPct(h.priceChangePct)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-family: 'JetBrains Mono', monospace;">
          ${formatPct(h.indexChangePct)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: ${impactBgColor(h.thesisImpact)}; color: ${impactColor(h.thesisImpact)}; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            ${h.thesisImpact.charAt(0).toUpperCase() + h.thesisImpact.slice(1)}
          </span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 13px; max-width: 300px;">
          ${h.summary ? h.summary.slice(0, 120) + (h.summary.length > 120 ? "..." : "") : "\u2014"}
        </td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 720px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">
        <h1 style="margin: 0 0 8px; font-size: 20px; color: #0f172a;">Weekly Thesis Update</h1>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
          ${data.total} holdings monitored:
          <span style="color: #16a34a; font-weight: 600;">${data.strengthened} strengthened</span>,
          <span style="color: #dc2626; font-weight: 600;">${data.weakened} weakened</span>,
          <span style="color: #6b7280; font-weight: 600;">${data.unchanged} unchanged</span>
        </p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Holding</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Price %</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">vs Index</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Impact</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Summary</th>
          </tr>
        </thead>
        <tbody>
          ${holdingRows}
        </tbody>
      </table>
      <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
        <a href="${data.appUrl}" style="color: #2563eb; text-decoration: none; font-size: 13px;">Open Thesis Tracker</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}
