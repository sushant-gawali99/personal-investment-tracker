export interface ExcelTextResult {
  text: string;
  sheetCount: number;
  sheetNames: string[];
}

export async function excelToText(bytes: Buffer): Promise<ExcelTextResult> {
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(bytes, {
    type: "buffer",
    // Pass raw date strings through unchanged — Claude's prompt handles Indian date formats.
    cellDates: false,
    // Apply each cell's number format so "1,00,000.00" is preserved as-is.
    // The Claude extraction prompt already handles Indian lakh-crore formatting.
    raw: false,
  });

  const sheetNames = workbook.SheetNames;
  const parts: string[] = [];

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim().replace(/,/g, "").length === 0) continue;
    parts.push(`--- Sheet: ${name} ---\n${csv}`);
  }

  return { text: parts.join("\n\n"), sheetCount: sheetNames.length, sheetNames };
}
