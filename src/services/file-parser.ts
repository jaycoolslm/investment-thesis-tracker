import ExcelJS from "exceljs";
import * as z from "zod";
import { Readable } from "stream";

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

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return "";
  if (typeof cell === "object" && "text" in cell) return String(cell.text);
  return String(cell).trim();
}

/**
 * Parse and validate a spreadsheet buffer (.xlsx or .csv).
 * Returns all rows with validation status and per-row errors.
 */
export async function parseSpreadsheet(
  buffer: Buffer,
  mimeType: string,
): Promise<ValidatedRow[]> {
  const workbook = new ExcelJS.Workbook();

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    // ExcelJS expects ArrayBuffer-like input
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
  } else {
    // CSV
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new ParseError("File is empty or has no data rows");
  }

  // Map header row to column indices
  const headerRow = worksheet.getRow(1);
  const columnMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const key = normalizeHeader(cellToString(cell.value));
    if (key) {
      columnMap[key] = colNumber;
    }
  });

  // Validate required columns
  const missing: string[] = [];
  if (!columnMap.ticker) missing.push("Ticker");
  if (!columnMap.direction) missing.push("Direction");
  if (!columnMap.bullets) missing.push("Thesis Bullets");
  if (missing.length > 0) {
    throw new ParseError(`Missing required columns: ${missing.join(", ")}`);
  }

  // Parse data rows
  const rows: ValidatedRow[] = [];

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);

    const rawTicker = cellToString(row.getCell(columnMap.ticker).value);
    const rawDirection = cellToString(row.getCell(columnMap.direction).value);
    const rawBullets = cellToString(row.getCell(columnMap.bullets).value);
    const rawCompanyName = columnMap.companyName
      ? cellToString(row.getCell(columnMap.companyName).value)
      : null;

    // Skip completely empty rows
    if (!rawTicker && !rawDirection && !rawBullets) continue;

    const result = rowSchema.safeParse({
      ticker: rawTicker,
      direction: rawDirection,
      bullets: rawBullets,
    });

    if (result.success) {
      rows.push({
        rowNumber: i,
        ticker: result.data.ticker.toUpperCase(),
        companyName: rawCompanyName || result.data.ticker.toUpperCase(),
        direction: result.data.direction,
        bullets: result.data.bullets,
        valid: true,
        errors: [],
      });
    } else {
      rows.push({
        rowNumber: i,
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
