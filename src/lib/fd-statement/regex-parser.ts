import type { ParsedTxn } from "./types";
import { classifyRow } from "./classify";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const ROW_RE =
  /(\d{2})-([A-Za-z]{3})-(\d{4})\s+(.+?)\s+(?:Tr|Ca)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+[\d,]+\.\d{2}/g;

function toIso(dd: string, mon: string, yyyy: string): string {
  const mm = MONTHS[mon.toLowerCase().slice(0, 3)];
  if (!mm) return "";
  return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
}

function num(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

export function parseStatementText(text: string): ParsedTxn[] {
  const flat = text
    .replace(/-\s*\n\s*/g, "-")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ");
  const out: ParsedTxn[] = [];
  for (const m of flat.matchAll(ROW_RE)) {
    const [, dd, mon, yyyy, particulars, debitStr, creditStr] = m;
    const iso = toIso(dd, mon, yyyy);
    if (!iso) continue;
    const { type, detectedFdNumber } = classifyRow(particulars);
    out.push({
      txnDate: iso,
      particulars: particulars.trim(),
      debit: num(debitStr),
      credit: num(creditStr),
      type,
      detectedFdNumber,
    });
  }
  return out;
}
