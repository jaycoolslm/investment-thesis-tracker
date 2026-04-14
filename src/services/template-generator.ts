import ExcelJS from "exceljs";

let cachedBuffer: Buffer | null = null;

/** Generate (and cache) the bulk upload template .xlsx file. */
export async function getTemplateBuffer(): Promise<Buffer> {
  if (cachedBuffer) return cachedBuffer;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Holdings");

  // Headers
  sheet.columns = [
    { header: "Ticker", key: "ticker", width: 12 },
    { header: "Company Name", key: "companyName", width: 25 },
    { header: "Direction", key: "direction", width: 12 },
    { header: "Thesis Bullets", key: "bullets", width: 60 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "F1F5F9" },
  };

  // Example row
  sheet.addRow({
    ticker: "AAPL",
    companyName: "Apple Inc.",
    direction: "Long",
    bullets:
      "Strong iPhone cycle, growing services revenue, expanding margins from hardware-to-services shift",
  });

  // Add data validation dropdown for Direction column (rows 2–1000)
  for (let i = 2; i <= 1000; i++) {
    sheet.getCell(`C${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Long,Short"'],
      showErrorMessage: true,
      errorTitle: "Invalid Direction",
      error: "Please select Long or Short",
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  cachedBuffer = Buffer.from(arrayBuffer);
  return cachedBuffer;
}
