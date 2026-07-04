import * as z from "zod";

export interface ValidatedRow {
  rowNumber: number;
  ticker: string | null;
  companyName: string | null;
  direction: "long" | "short" | null;
  bullets: string | null;
  valid: boolean;
  errors: string[];
}

const rowSchema = z.object({
  ticker: z.string().min(1, "Missing ticker").max(20, "Ticker too long"),
  direction: z
    .string()
    .min(1, "Missing direction")
    .transform((v) => v.toLowerCase())
    .pipe(
      z.enum(["long", "short"], {
        message: "Direction must be Long or Short",
      }),
    ),
  bullets: z.string().min(1, "No thesis bullets provided"),
});

/** Normalize column header to a standard key. Returns null if unrecognised. */
function normalizeHeader(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (h === "ticker") return "ticker";
  if (h === "company name" || h === "company") return "companyName";
  if (h === "direction") return "direction";
  if (
    h === "thesis bullets" ||
    h === "bullets" ||
    h === "thesis_bullets"
  )
    return "bullets";
  return null;
}

/**
 * Minimal RFC 4180 CSV parser: quoted fields may contain commas, escaped
 * quotes ("") and newlines; records end on LF, CR or CRLF; a leading BOM is
 * stripped. Returns one string[] per record, including blank lines (so record
 * indices map to file line numbers); a trailing newline adds no record.
 */
export function parseCsvRecords(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

/**
 * Parse and validate a CSV buffer for bulk upload.
 * Returns all data rows with validation status and per-row errors.
 * Row numbers match the file (header = row 1, first data row = row 2).
 */
export function parseCsv(buffer: Buffer): ValidatedRow[] {
  const records = parseCsvRecords(buffer.toString("utf8"));

  if (records.length < 2) {
    throw new ParseError("File is empty or has no data rows");
  }

  // Map header row to column indices
  const columnMap: Record<string, number> = {};
  records[0].forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key && !(key in columnMap)) {
      columnMap[key] = index;
    }
  });

  const missing: string[] = [];
  if (!("ticker" in columnMap)) missing.push("Ticker");
  if (!("direction" in columnMap)) missing.push("Direction");
  if (!("bullets" in columnMap)) missing.push("Thesis Bullets");
  if (missing.length > 0) {
    throw new ParseError(`Missing required columns: ${missing.join(", ")}`);
  }

  const cell = (record: string[], key: string): string =>
    (record[columnMap[key]] ?? "").trim();

  const rows: ValidatedRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    const rowNumber = i + 1;

    const rawTicker = cell(record, "ticker");
    const rawDirection = cell(record, "direction");
    const rawBullets = cell(record, "bullets");
    const rawCompanyName =
      "companyName" in columnMap ? cell(record, "companyName") : null;

    // Skip completely empty rows (including blank lines)
    if (!rawTicker && !rawDirection && !rawBullets) continue;

    const result = rowSchema.safeParse({
      ticker: rawTicker,
      direction: rawDirection,
      bullets: rawBullets,
    });

    if (result.success) {
      rows.push({
        rowNumber,
        ticker: result.data.ticker.toUpperCase(),
        companyName: rawCompanyName || result.data.ticker.toUpperCase(),
        direction: result.data.direction,
        bullets: result.data.bullets,
        valid: true,
        errors: [],
      });
    } else {
      rows.push({
        rowNumber,
        ticker: rawTicker || null,
        companyName: rawCompanyName,
        direction: null,
        bullets: rawBullets || null,
        valid: false,
        errors: result.error.issues.map((iss) => iss.message),
      });
    }
  }

  if (rows.length === 0) {
    throw new ParseError("File is empty or has no data rows");
  }

  return rows;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}
