import { extractPdfText } from "@/lib/bank-accounts/pdf-text";

export interface NJScheme {
  serial: number;
  scheme: string;
  subType: string;
  invested: number;
  divReinv: number;
  units: number;
  currentValue: number;
  divR: number;
  divP: number;
  total: number;
  annualizedReturnPct: number | null;
  absoluteReturnPct: number | null;
  holdingPct: number;
  tenure: string;
}

export interface NJParsed {
  reportDate: Date | null;
  investorName: string | null;
  schemes: NJScheme[];
  totalInvested: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  weightedReturnPct: number | null;
  absoluteReturnPct: number | null;
}

const NUM = String.raw`-?[\d,]+(?:\.\d+)?`;
const TENURE = String.raw`LT|ST|Both`;

// Each scheme row ends with: annualizedReturn absReturn holdingPct tenure
// and starts with a serial number. Tenure tags serve as row anchors.
const ROW_RE = new RegExp(
  `(\\d+)\\s+(.+?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM}|NA)\\s+(${NUM}|NA)\\s+(${NUM})\\s+(${TENURE})`,
  "g"
);

function num(s: string): number {
  if (s === "NA" || s === "-" || s === "") return 0;
  return parseFloat(s.replace(/,/g, ""));
}

function numOrNull(s: string): number | null {
  if (s === "NA" || s === "-" || s === "") return null;
  const v = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

function parseReportDate(text: string): Date | null {
  const m = text.match(/As on Date\s*:\s*(\d{1,2})-(\d{1,2})-(\d{4})/i);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseInvestor(text: string): string | null {
  // Line right after the date header is the investor name
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => /Valuation Report/i.test(l));
  if (idx < 0 || idx + 1 >= lines.length) return null;
  const candidate = lines[idx + 1];
  if (/^(Address|City|Pincode|E-Mail|Mobile)/i.test(candidate)) return null;
  return candidate;
}

function parseGrandTotal(text: string): { invested: number; value: number; weighted: number | null; absolute: number | null } | null {
  // "Grand Total 42,35,708.23 0.00 1,22,194.889 69,08,784.98 ..."
  const m = text.match(
    new RegExp(`Grand\\s+Total\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM}|NA)\\s+(${NUM}|NA)`, "i")
  );
  if (!m) return null;
  return {
    invested: num(m[1]),
    value: num(m[4]),
    weighted: numOrNull(m[8]),
    absolute: numOrNull(m[9]),
  };
}

export function parseNJIndiaText(text: string): NJParsed {
  // Collapse internal newlines inside long scheme names:
  // the PDF sometimes wraps a scheme name across two lines before the sub-type column.
  const cleaned = text.replace(/[\u00A0]/g, " ");

  // Restrict parsing window to "Investor All" → "Grand Total" to avoid matching
  // digits in the header (dates, pincodes, mobiles).
  const startIdx = cleaned.search(/Investor\s+All\b/i);
  const endIdx = cleaned.search(/Grand\s+Total/i);
  const body = startIdx >= 0 && endIdx > startIdx
    ? cleaned.slice(startIdx + "Investor All".length, endIdx)
    : cleaned;

  // Drop page footer/header noise between pages so scheme names don't pick it up.
  const bodyClean = body
    .replace(/\|\s*Anti Money Laundering[^|]*\|[^|]*\|[^|]*\|[^|]*\|/gi, " ")
    .replace(/--\s*\d+\s*of\s*\d+\s*--/g, " ")
    .replace(/V\.G\.INVESTMENTS\.?/g, " ")
    .replace(/Sr\.\s*No\.\s*Scheme[\s\S]*?Tenure/g, " ");

  const flat = bodyClean.replace(/\s+/g, " ");

  const schemes: NJScheme[] = [];
  const seen = new Set<number>();
  for (const m of flat.matchAll(ROW_RE)) {
    const serial = parseInt(m[1]);
    if (seen.has(serial)) continue;
    seen.add(serial);
    const rawName = m[2].trim();
    // Last 1–3 words of rawName form the sub-type (before the first amount column).
    // Strategy: find where the sub-type starts by splitting tokens. Sub-types are
    // short descriptors like "Multi Cap", "Small Cap", "ELSS", "Agg. Hybrid", "Flexi Cap",
    // "Large and Mid Cap", "Large Cap", "Mid Cap", "Focused", "Contra", "Bal Adv",
    // "Equity Sav", "Multi AA".
    const subTypePatterns = [
      "Large and Mid Cap",
      "Multi Asset Allocation",
      "Agg. Hybrid",
      "Equity Sav",
      "Bal Adv",
      "Multi AA",
      "Multi Cap",
      "Small Cap",
      "Large Cap",
      "Mid Cap",
      "Flexi Cap",
      "Focused",
      "Contra",
      "ELSS",
      "Arbitrage",
      "Conservative Hybrid",
      "Dynamic AA",
      "Index",
      "ETF",
      "Debt",
      "Liquid",
      "Gilt",
      "Gold",
      "Hybrid",
      "Thematic",
      "Sectoral",
      "Value",
      "Dividend Yield",
    ];
    let scheme = rawName;
    let subType = "";
    for (const p of subTypePatterns) {
      if (rawName.endsWith(" " + p)) {
        scheme = rawName.slice(0, -p.length - 1).trim();
        subType = p;
        break;
      }
    }
    if (!subType) {
      // Fallback: assume last 1-2 tokens are sub-type
      const parts = rawName.split(" ");
      subType = parts.slice(-2).join(" ");
      scheme = parts.slice(0, -2).join(" ");
    }
    schemes.push({
      serial,
      scheme,
      subType,
      invested: num(m[3]),
      divReinv: num(m[4]),
      units: num(m[5]),
      currentValue: num(m[6]),
      divR: num(m[7]),
      divP: num(m[8]),
      total: num(m[9]),
      annualizedReturnPct: numOrNull(m[10]),
      absoluteReturnPct: numOrNull(m[11]),
      holdingPct: num(m[12]),
      tenure: m[13],
    });
  }

  schemes.sort((a, b) => a.serial - b.serial);

  const grand = parseGrandTotal(flat);
  const totalInvested = grand?.invested ?? schemes.reduce((s, x) => s + x.invested, 0);
  const totalCurrentValue = grand?.value ?? schemes.reduce((s, x) => s + x.currentValue, 0);

  // The "Return : X% | Weighted Avg.Abs. Return : Y%" line sits after Grand Total.
  const retLine = cleaned.replace(/\s+/g, " ").match(/Return\s*:\s*(-?[\d.]+)\s*%\s*\|\s*Weighted\s+Avg\.?\s*Abs\.?\s*Return\s*:\s*(-?[\d.]+)\s*%/i);
  const weightedReturnPct = retLine ? parseFloat(retLine[1]) : grand?.weighted ?? null;
  const absoluteReturnPct = retLine ? parseFloat(retLine[2]) : grand?.absolute ?? null;

  return {
    reportDate: parseReportDate(text),
    investorName: parseInvestor(text),
    schemes,
    totalInvested,
    totalCurrentValue,
    totalGainLoss: totalCurrentValue - totalInvested,
    weightedReturnPct,
    absoluteReturnPct,
  };
}

export async function parseNJIndiaPdf(pdfBytes: Buffer): Promise<NJParsed> {
  const { text } = await extractPdfText(pdfBytes);
  const parsed = parseNJIndiaText(text);
  if (parsed.schemes.length === 0) {
    throw new Error("Could not parse any scheme rows from this PDF. Is this an NJ India Scheme-Wise Valuation Report?");
  }
  return parsed;
}
