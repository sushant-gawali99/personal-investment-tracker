import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";

const SOURCE_SCRAPE = "goodreturns-pune";
const SOURCE_MANUAL = "manual";
const URL = "https://www.goodreturns.in/gold-rates/pune.html";

export type GoldRatePayload = {
  date: string;              // ISO date (yyyy-mm-dd UTC) of the rate row used
  rate22kPerG: number;
  rate24kPerG: number;
  source: string;            // "goodreturns-pune" | "manual"
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

// Extract the first INR-per-gram value near a label such as "22 Carat" or "24 Carat".
// goodreturns.in typically renders a table with "Today" 1g prices per karat.
function parseRates(html: string): { rate22kPerG: number; rate24kPerG: number } {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");

  function findGramRate(karatLabel: "22" | "24"): number {
    // Match "22 Carat Gold ... 1 gram ... ₹6,820" or similar variants.
    const re = new RegExp(`${karatLabel}\\s*Carat[^₹]*?₹\\s*([0-9,]+)`, "i");
    const m = text.match(re);
    if (!m) throw new Error(`Could not locate ${karatLabel}K rate on page`);
    return Number(m[1].replace(/,/g, ""));
  }

  const rate22kPerG = findGramRate("22");
  const rate24kPerG = findGramRate("24");
  if (!rate22kPerG || !rate24kPerG) throw new Error("Parsed gold rates are invalid");
  return { rate22kPerG, rate24kPerG };
}

export async function scrapeGoodreturnsPune(): Promise<{ rate22kPerG: number; rate24kPerG: number }> {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Accept": "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`goodreturns responded ${res.status}`);
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
    const { rate22kPerG, rate24kPerG } = await scrapeGoodreturnsPune();
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
  const { rate22kPerG, rate24kPerG } = await scrapeGoodreturnsPune();
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
