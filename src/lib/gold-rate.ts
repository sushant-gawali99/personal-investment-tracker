import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";

const SOURCE_SCRAPE = "ibja";
const SOURCE_MANUAL = "manual";
const URL = "https://ibjarates.com/";

export type GoldRatePayload = {
  date: string;              // ISO date (yyyy-mm-dd UTC) of the rate row used
  rate22kPerG: number;
  rate24kPerG: number;
  source: string;            // "ibja" | "manual"
  staleAsOf?: string;        // present when today's rate was unavailable
};

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toPayload(row: { date: Date; rate22kPerG: number; rate24kPerG: number; source: string }, stale = false): GoldRatePayload {
  const iso = row.date.toISOString().slice(0, 10);
  return {
    date: iso,
    rate22kPerG: row.rate22kPerG,
    rate24kPerG: row.rate24kPerG,
    source: row.source,
    ...(stale ? { staleAsOf: iso } : {}),
  };
}

// IBJA publishes a table of daily reference rates. Each row has cells labelled
// with `data-label="Gold 999"` (24K, per 10g) and `data-label="Gold 916"` (22K, per 10g).
// We take the first (most recent) row.
function parseRates(html: string): { rate22kPerG: number; rate24kPerG: number } {
  const $ = cheerio.load(html);

  function firstCell(label: string): number {
    const el = $(`td[data-label="${label}"]`).first();
    if (!el.length) throw new Error(`Could not locate ${label} cell on IBJA page`);
    const raw = el.text().replace(/[^0-9.]/g, "");
    const n = Number(raw);
    if (!(n > 0)) throw new Error(`Invalid ${label} value: ${el.text()}`);
    return n;
  }

  const per10g24 = firstCell("Gold 999");
  const per10g22 = firstCell("Gold 916");
  // IBJA quotes per 10 grams in INR — divide by 10 for per-gram rate.
  const rate24kPerG = per10g24 / 10;
  const rate22kPerG = per10g22 / 10;
  if (!rate22kPerG || !rate24kPerG) throw new Error("Parsed IBJA gold rates are invalid");
  return { rate22kPerG, rate24kPerG };
}

export async function scrapeIbja(): Promise<{ rate22kPerG: number; rate24kPerG: number }> {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`IBJA responded ${res.status}`);
  const html = await res.text();
  return parseRates(html);
}

export async function getTodaysRate(): Promise<GoldRatePayload | null> {
  const today = todayUtcMidnight();

  const existing = await prisma.goldRate.findMany({
    where: { date: today },
    orderBy: { fetchedAt: "desc" },
  });
  const manual = existing.find((r) => r.source === SOURCE_MANUAL);
  if (manual) return toPayload(manual);
  const scraped = existing.find((r) => r.source === SOURCE_SCRAPE);
  if (scraped) return toPayload(scraped);

  try {
    const { rate22kPerG, rate24kPerG } = await scrapeIbja();
    const row = await prisma.goldRate.upsert({
      where: { date_source: { date: today, source: SOURCE_SCRAPE } },
      create: { date: today, source: SOURCE_SCRAPE, rate22kPerG, rate24kPerG },
      update: { rate22kPerG, rate24kPerG, fetchedAt: new Date() },
    });
    return toPayload(row);
  } catch {
    const lastKnown = await prisma.goldRate.findFirst({ orderBy: { date: "desc" } });
    return lastKnown ? toPayload(lastKnown, true) : null;
  }
}

export async function refreshTodaysRate(): Promise<GoldRatePayload> {
  const today = todayUtcMidnight();
  const { rate22kPerG, rate24kPerG } = await scrapeIbja();
  const row = await prisma.goldRate.upsert({
    where: { date_source: { date: today, source: SOURCE_SCRAPE } },
    create: { date: today, source: SOURCE_SCRAPE, rate22kPerG, rate24kPerG },
    update: { rate22kPerG, rate24kPerG, fetchedAt: new Date() },
  });
  return toPayload(row);
}

export async function setManualRate(input: { rate22kPerG: number; rate24kPerG: number }): Promise<GoldRatePayload> {
  const today = todayUtcMidnight();
  const row = await prisma.goldRate.upsert({
    where: { date_source: { date: today, source: SOURCE_MANUAL } },
    create: { date: today, source: SOURCE_MANUAL, rate22kPerG: input.rate22kPerG, rate24kPerG: input.rate24kPerG },
    update: { rate22kPerG: input.rate22kPerG, rate24kPerG: input.rate24kPerG, fetchedAt: new Date() },
  });
  return toPayload(row);
}

export async function clearManualRate(): Promise<void> {
  const today = todayUtcMidnight();
  await prisma.goldRate.deleteMany({ where: { date: today, source: SOURCE_MANUAL } });
}

// Pure valuation helper — shared by API enrichment and UI.
export function valuePerGram(karat: number, rate22kPerG: number, rate24kPerG: number): number {
  if (karat === 24) return rate24kPerG;
  if (karat === 22) return rate22kPerG;
  if (karat === 18) return rate24kPerG * 0.75;
  if (karat === 14) return rate24kPerG * 0.583;
  return rate24kPerG * (karat / 24);
}
