import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseCsvRecords,
  ParseError,
} from "../file-parser.js";

describe("parseCsvRecords", () => {
  it("splits simple rows and fields", () => {
    expect(parseCsvRecords("a,b,c\nd,e,f")).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsvRecords('a,"Smith, Jones & Co",c')).toEqual([
      ["a", "Smith, Jones & Co", "c"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsvRecords('"say ""hi""",b')).toEqual([['say "hi"', "b"]]);
  });

  it("handles newlines inside quoted fields", () => {
    expect(parseCsvRecords('a,"line1\nline2",c')).toEqual([
      ["a", "line1\nline2", "c"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsvRecords("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles bare CR line endings", () => {
    expect(parseCsvRecords("a,b\rc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("strips a leading BOM", () => {
    expect(parseCsvRecords("﻿a,b")).toEqual([["a", "b"]]);
  });

  it("does not add a record for a trailing newline", () => {
    expect(parseCsvRecords("a,b\n")).toEqual([["a", "b"]]);
  });

  it("preserves interior blank lines as empty records", () => {
    expect(parseCsvRecords("a,b\n\nc,d")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsvRecords("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseCsvRecords("")).toEqual([]);
  });
});

const HEADER = "Ticker,Company Name,Direction,Thesis Bullets";

function buf(text: string): Buffer {
  return Buffer.from(text, "utf8");
}

describe("parseCsv", () => {
  it("parses valid rows and uppercases tickers", () => {
    const rows = parseCsv(
      buf(`${HEADER}\naapl,Apple Inc.,Long,Strong iPhone cycle`),
    );
    expect(rows).toEqual([
      {
        rowNumber: 2,
        ticker: "AAPL",
        companyName: "Apple Inc.",
        direction: "long",
        bullets: "Strong iPhone cycle",
        valid: true,
        errors: [],
      },
    ]);
  });

  it("parses quoted company names with commas", () => {
    const rows = parseCsv(
      buf(`${HEADER}\nSJC,"Smith, Jones & Co",Short,Overvalued`),
    );
    expect(rows[0].companyName).toBe("Smith, Jones & Co");
    expect(rows[0].valid).toBe(true);
  });

  it("defaults company name to the ticker when the column is blank", () => {
    const rows = parseCsv(buf(`${HEADER}\nMSFT,,Long,Cloud growth`));
    expect(rows[0].companyName).toBe("MSFT");
  });

  it("accepts header aliases and missing optional column", () => {
    const rows = parseCsv(buf("ticker,direction,bullets\nGOOG,long,Search"));
    expect(rows[0]).toMatchObject({
      ticker: "GOOG",
      companyName: "GOOG",
      valid: true,
    });
  });

  it("flags invalid rows with specific errors and keeps file row numbers", () => {
    const rows = parseCsv(
      buf(
        `${HEADER}\nAAPL,Apple,Long,Good\n,NoTicker,Sideways,\nTSLA,Tesla,Short,Overvalued`,
      ),
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.valid)).toHaveLength(2);
    const bad = rows[1];
    expect(bad.rowNumber).toBe(3);
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain("Missing ticker");
    expect(bad.errors).toContain("Direction must be Long or Short");
    expect(bad.errors).toContain("No thesis bullets provided");
  });

  it("skips completely blank lines without shifting row numbers", () => {
    const rows = parseCsv(buf(`${HEADER}\n\nAAPL,Apple,Long,Good\n`));
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(3);
  });

  it("handles BOM + CRLF files (Excel CSV export shape)", () => {
    const rows = parseCsv(
      buf(`﻿${HEADER}\r\nAAPL,Apple,Long,Good\r\n`),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].valid).toBe(true);
  });

  it("throws ParseError when required columns are missing", () => {
    expect(() => parseCsv(buf("Ticker,Notes\nAAPL,hi"))).toThrow(ParseError);
    expect(() => parseCsv(buf("Ticker,Notes\nAAPL,hi"))).toThrow(
      /Missing required columns: Direction, Thesis Bullets/,
    );
  });

  it("throws ParseError for an empty file", () => {
    expect(() => parseCsv(buf(""))).toThrow(/empty or has no data rows/);
  });

  it("throws ParseError for a header-only file", () => {
    expect(() => parseCsv(buf(`${HEADER}\n`))).toThrow(
      /empty or has no data rows/,
    );
  });
});
