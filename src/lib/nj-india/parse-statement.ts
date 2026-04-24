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

// Anchor on the trailing block: 10 numeric columns + tenure. Works regardless
// of where wrapped scheme-name fragments land after coordinate reconstruction.
const ANCHOR_RE = new RegExp(
  `(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM}|NA)\\s+(${NUM}|NA)\\s+(${NUM})\\s+(${TENURE})\\b`,
  "g"
);

const SUBTYPES = [
  "Large and Mid Cap",
  "Multi Asset Allocation",
  "Conservative Hybrid",
  "Dividend Yield",
  "Agg. Hybrid",
  "Equity Sav",
  "Dynamic AA",
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
  "Thematic",
  "Sectoral",
  "Index",
  "ETF",
  "Debt",
  "Liquid",
  "Gilt",
  "Gold",
  "Hybrid",
  "Value",
];

const AMC_PREFIXES = [
  "Aditya Birla Sun Life",
  "Nippon India",
  "Canara Robeco",
  "Franklin India",
  "Invesco India",
  "ICICI Prudential",
  "Mirae Asset",
  "Motilal Oswal",
  "Parag Parikh",
  "Bandhan",
  "Quant",
  "PPFAS",
  "Tata",
  "Axis",
  "HDFC",
  "HSBC",
  "Kotak",
  "SBI",
  "DSP",
  "UTI",
  "L&T",
  "Edelweiss",
  "Baroda",
  "PGIM",
  "Sundaram",
  "JM",
  "IDFC",
];

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
  let prevEnd = 0;
  for (const m of flat.matchAll(ANCHOR_RE)) {
    const prefix = flat.slice(prevEnd, m.index!).trim();
    prevEnd = m.index! + m[0].length;

    // Serial = last standalone integer in prefix (wrap-leftover from prev row
    // contains only alphabetic tokens, so the actual serial sits last).
    const serialMatches = [...prefix.matchAll(/(?:^|\s)(\d+)(?=\s|$)/g)];
    if (serialMatches.length === 0) continue;
    const lastSerial = serialMatches[serialMatches.length - 1];
    const serial = parseInt(lastSerial[1]);
    if (seen.has(serial)) continue;

    // Remove the serial, leaving name + subtype tokens (possibly scattered).
    const sIdx = lastSerial.index! + lastSerial[0].indexOf(lastSerial[1]);
    const before = prefix.slice(0, sIdx).trim();
    const after = prefix.slice(sIdx + lastSerial[1].length).trim();
    const nameAndSubtype = `${before} ${after}`.trim().replace(/\s+/g, " ");

    // Sub-type: match known pattern at end of nameAndSubtype.
    let scheme = nameAndSubtype;
    let subType = "";
    for (const p of SUBTYPES) {
      if (nameAndSubtype.endsWith(" " + p) || nameAndSubtype === p) {
        scheme = nameAndSubtype.slice(0, nameAndSubtype.length - p.length).trim();
        subType = p;
        break;
      }
    }

    // Clip any leading wrap-leftover from the previous row by locating the
    // earliest AMC prefix in the scheme text.
    let clipIdx = -1;
    for (const p of AMC_PREFIXES) {
      const idx = scheme.toLowerCase().indexOf(p.toLowerCase());
      if (idx >= 0 && (clipIdx === -1 || idx < clipIdx)) clipIdx = idx;
    }
    if (clipIdx > 0) scheme = scheme.slice(clipIdx).trim();

    if (!scheme || !/^[A-Za-z]/.test(scheme)) continue;

    seen.add(serial);
    schemes.push({
      serial,
      scheme,
      subType,
      invested: num(m[1]),
      divReinv: num(m[2]),
      units: num(m[3]),
      currentValue: num(m[4]),
      divR: num(m[5]),
      divP: num(m[6]),
      total: num(m[7]),
      annualizedReturnPct: numOrNull(m[8]),
      absoluteReturnPct: numOrNull(m[9]),
      holdingPct: num(m[10]),
      tenure: m[11],
    });
  }

  schemes.sort((a, b) => a.serial - b.serial);

  const grand = parseGrandTotal(cleaned.replace(/\s+/g, " "));
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
