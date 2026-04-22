# Gold Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Gold" module to the personal investment tracker that manages jewellery items, fetches daily Pune gold rates from goodreturns.in (with manual override), and shows per-item current valuation plus optional gain/loss.

**Architecture:** Two new Prisma models (`GoldItem`, `GoldRate`). A rate fetch service with lazy daily scrape. Next.js App Router API routes mirroring the existing FD pattern. A new dashboard page and an overview summary card.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + libsql, next-auth, TypeScript, Tailwind v4, `cheerio` (to be added) for HTML parsing, `lucide-react` icons.

**Spec:** [docs/superpowers/specs/2026-04-22-gold-module-design.md](../specs/2026-04-22-gold-module-design.md)

**Project convention notes:**
- No automated test harness exists. Each task ends with manual verification steps (dev server, curl, or UI checks).
- Prisma schema uses `db push` (no migrations folder). Schema file: `prisma/schema.prisma`.
- Session helper: `src/lib/session.ts` → `requireUserId()` (returns `NextResponse` on unauth).
- Per user memory, commits must NOT include a `Co-Authored-By: Claude` trailer.
- IMPORTANT: Next.js in this project has breaking changes from public docs; before touching route or API code, skim the relevant guide under `node_modules/next/dist/docs/` (per `AGENTS.md`).

---

## File Structure

**New files:**
- `src/lib/gold-rate.ts` — rate fetch / cache / override service
- `src/app/api/gold/route.ts` — list + create
- `src/app/api/gold/[id]/route.ts` — read + update + delete
- `src/app/api/gold/upload/route.ts` — photo upload
- `src/app/api/gold/image/[filename]/route.ts` — photo serve
- `src/app/api/gold/rate/route.ts` — GET current rate
- `src/app/api/gold/rate/refresh/route.ts` — POST force refresh
- `src/app/api/gold/rate/manual/route.ts` — POST/DELETE manual override
- `src/app/dashboard/gold/page.tsx` — server component list page
- `src/app/dashboard/gold/gold-list.tsx` — client list UI
- `src/app/dashboard/gold/gold-form-dialog.tsx` — add/edit dialog
- `src/app/dashboard/gold/manual-rate-dialog.tsx` — rate override dialog
- `src/app/dashboard/gold/rate-chip.tsx` — header rate chip

**Modified files:**
- `prisma/schema.prisma` — add two models
- `package.json` — add `cheerio`
- `src/components/sidebar.tsx` — add Gold nav entry
- `src/app/dashboard/overview-client.tsx` (or the overview page) — add Gold summary card

---

## Task 1: Add Prisma models and push schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `GoldItem` and `GoldRate` models**

Append to `prisma/schema.prisma`:

```prisma
model GoldItem {
  id             String   @id @default(cuid())
  userId         String   @default("")
  title          String
  weightGrams    Float
  karat          Int
  photoUrl       String?
  purchasedOn    DateTime?
  purchasedFrom  String?
  purchasePrice  Float?
  notes          String?
  disabled       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
}

model GoldRate {
  id           String   @id @default(cuid())
  date         DateTime
  source       String
  rate24kPerG  Float
  rate22kPerG  Float
  fetchedAt    DateTime @default(now())

  @@unique([date, source])
}
```

- [ ] **Step 2: Push schema and regenerate client**

Run:
```bash
npx prisma db push
npx prisma generate
```

Expected: "Your database is now in sync with your Prisma schema." and a successful client generation.

- [ ] **Step 3: Verify models are accessible**

Run:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.goldItem.findMany().then(r=>{console.log('GoldItem count:',r.length);return p.goldRate.findMany()}).then(r=>{console.log('GoldRate count:',r.length);return p.\$disconnect()}).catch(e=>{console.error(e);process.exit(1)})"
```

Expected: `GoldItem count: 0` and `GoldRate count: 0`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(gold): add GoldItem and GoldRate prisma models"
```

---

## Task 2: Add cheerio dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install cheerio**

Run:
```bash
npm install cheerio
```

Expected: `cheerio` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Sanity-check import resolves**

Run:
```bash
node -e "const c=require('cheerio');console.log('cheerio ok:',typeof c.load)"
```

Expected: `cheerio ok: function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(gold): add cheerio for HTML scraping"
```

---

## Task 3: Implement gold rate service

**Files:**
- Create: `src/lib/gold-rate.ts`

- [ ] **Step 1: Write `gold-rate.ts`**

```ts
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
```

- [ ] **Step 2: Type-check compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors related to `src/lib/gold-rate.ts`.

- [ ] **Step 3: Smoke-test scraper end-to-end**

Run:
```bash
node --experimental-vm-modules -e "require('ts-node/register');const m=require('./src/lib/gold-rate.ts');m.scrapeGoodreturnsPune().then(r=>console.log(r)).catch(e=>{console.error('FAIL',e);process.exit(1)})" 2>/dev/null || npx tsx -e "import('./src/lib/gold-rate').then(m=>m.scrapeGoodreturnsPune()).then(r=>console.log(r)).catch(e=>{console.error('FAIL',e);process.exit(1)})"
```

Expected: an object like `{ rate22kPerG: 6820, rate24kPerG: 7440 }` (exact numbers vary). If parsing fails, inspect the page HTML and adjust the regexes in `parseRates` — this is the most likely place to need a tweak after site changes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/gold-rate.ts
git commit -m "feat(gold): rate fetch service with scrape + manual override"
```

---

## Task 4: Rate API routes

**Files:**
- Create: `src/app/api/gold/rate/route.ts`
- Create: `src/app/api/gold/rate/refresh/route.ts`
- Create: `src/app/api/gold/rate/manual/route.ts`

- [ ] **Step 1: Write `src/app/api/gold/rate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getTodaysRate } from "@/lib/gold-rate";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const rate = await getTodaysRate();
  if (!rate) return NextResponse.json({ error: "No rate available. Set a manual rate or retry." }, { status: 503 });
  return NextResponse.json(rate);
}
```

- [ ] **Step 2: Write `src/app/api/gold/rate/refresh/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { refreshTodaysRate } from "@/lib/gold-rate";

export async function POST() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  try {
    const rate = await refreshTodaysRate();
    return NextResponse.json(rate);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scrape failed" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Write `src/app/api/gold/rate/manual/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { setManualRate, clearManualRate } from "@/lib/gold-rate";

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const rate22kPerG = Number(body.rate22kPerG);
  const rate24kPerG = Number(body.rate24kPerG);
  if (!(rate22kPerG > 0) || !(rate24kPerG > 0)) {
    return NextResponse.json({ error: "Both rates must be positive numbers" }, { status: 400 });
  }
  const rate = await setManualRate({ rate22kPerG, rate24kPerG });
  return NextResponse.json(rate);
}

export async function DELETE() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await clearManualRate();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Manual verification**

Start dev server: `npm run dev` (keep running in another terminal).

Log in via the app first to get a cookie. Then in the browser devtools Network tab, or using a logged-in `curl` with the session cookie:

```bash
curl -i -b "next-auth.session-token=<token>" http://localhost:3000/api/gold/rate
```

Expected: `200 OK` with JSON `{ date, rate22kPerG, rate24kPerG, source, ... }`.

Also verify: unauthenticated request returns `401`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/gold/rate
git commit -m "feat(gold): rate API routes (get, refresh, manual)"
```

---

## Task 5: Gold item CRUD API — list and create

**Files:**
- Create: `src/app/api/gold/route.ts`

- [ ] **Step 1: Write `route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const [items, rate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getTodaysRate(),
  ]);

  const enriched = items.map((item) => {
    let currentValue: number | null = null;
    let gainLoss: number | null = null;
    if (rate) {
      const perG = valuePerGram(item.karat, rate.rate22kPerG, rate.rate24kPerG);
      currentValue = perG * item.weightGrams;
      if (item.purchasePrice != null) gainLoss = currentValue - item.purchasePrice;
    }
    return { ...item, currentValue, gainLoss };
  });

  return NextResponse.json({ items: enriched, rate });
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const body = await req.json();
  const { title, weightGrams, karat, photoUrl, purchasedOn, purchasedFrom, purchasePrice, notes } = body;

  if (!title || typeof title !== "string") return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const w = Number(weightGrams);
  if (!(w > 0)) return NextResponse.json({ error: "Weight (g) must be positive" }, { status: 400 });
  const k = Number(karat);
  if (![24, 22, 18, 14].includes(k)) return NextResponse.json({ error: "Karat must be 24, 22, 18, or 14" }, { status: 400 });

  const item = await prisma.goldItem.create({
    data: {
      userId,
      title: title.trim().slice(0, 200),
      weightGrams: w,
      karat: k,
      photoUrl: typeof photoUrl === "string" && photoUrl ? photoUrl : null,
      purchasedOn: purchasedOn ? new Date(purchasedOn) : null,
      purchasedFrom: typeof purchasedFrom === "string" && purchasedFrom.trim() ? purchasedFrom.trim().slice(0, 200) : null,
      purchasePrice: purchasePrice != null && purchasePrice !== "" ? Number(purchasePrice) : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
```

- [ ] **Step 2: Manual verification**

With dev server running and logged in:

```bash
curl -i -X POST -H "Content-Type: application/json" -b "next-auth.session-token=<token>" \
  -d '{"title":"Test chain","weightGrams":10,"karat":22}' \
  http://localhost:3000/api/gold

curl -s -b "next-auth.session-token=<token>" http://localhost:3000/api/gold | head
```

Expected: create returns 201 with item; list returns array containing that item with `currentValue` populated (non-null when rate is available) and `gainLoss: null`.

Also verify validation errors: empty title → 400, weight 0 → 400, karat 17 → 400.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gold/route.ts
git commit -m "feat(gold): list and create item API"
```

---

## Task 6: Gold item CRUD API — read, update, delete

**Files:**
- Create: `src/app/api/gold/[id]/route.ts`

- [ ] **Step 1: Write route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "gold");

async function findOwned(id: string, userId: string) {
  const item = await prisma.goldItem.findFirst({ where: { id, userId } });
  return item;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const item = await findOwned(id, auth);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await findOwned(id, auth);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title != null) {
    if (!body.title || typeof body.title !== "string") return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    data.title = body.title.trim().slice(0, 200);
  }
  if (body.weightGrams != null) {
    const w = Number(body.weightGrams);
    if (!(w > 0)) return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
    data.weightGrams = w;
  }
  if (body.karat != null) {
    const k = Number(body.karat);
    if (![24, 22, 18, 14].includes(k)) return NextResponse.json({ error: "Invalid karat" }, { status: 400 });
    data.karat = k;
  }
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null;
  if (body.purchasedOn !== undefined) data.purchasedOn = body.purchasedOn ? new Date(body.purchasedOn) : null;
  if (body.purchasedFrom !== undefined) data.purchasedFrom = body.purchasedFrom ? String(body.purchasedFrom).trim().slice(0, 200) : null;
  if (body.purchasePrice !== undefined) data.purchasePrice = body.purchasePrice != null && body.purchasePrice !== "" ? Number(body.purchasePrice) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.disabled !== undefined) data.disabled = Boolean(body.disabled);

  const item = await prisma.goldItem.update({ where: { id }, data });

  if (body.photoUrl !== undefined && existing.photoUrl && existing.photoUrl !== item.photoUrl) {
    const filename = existing.photoUrl.split("/").pop();
    if (filename) await unlink(join(UPLOAD_DIR, filename)).catch(() => {});
  }

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await findOwned(id, auth);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goldItem.delete({ where: { id } });

  if (existing.photoUrl) {
    const filename = existing.photoUrl.split("/").pop();
    if (filename) await unlink(join(UPLOAD_DIR, filename)).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Manual verification**

With dev server running, logged in, and using an item id from Task 5:

```bash
ID=<id-from-list>
curl -i -X PATCH -H "Content-Type: application/json" -b "..." -d '{"karat":24}' http://localhost:3000/api/gold/$ID
curl -i -b "..." http://localhost:3000/api/gold/$ID
curl -i -X DELETE -b "..." http://localhost:3000/api/gold/$ID
curl -i -b "..." http://localhost:3000/api/gold/$ID   # expect 404
```

Expected: PATCH returns updated item with `karat: 24`, DELETE returns `{ok:true}`, follow-up GET returns 404.

Verify cross-user access: a different user's GET/PATCH/DELETE of this id returns 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gold/[id]/route.ts
git commit -m "feat(gold): item read, update, delete API"
```

---

## Task 7: Photo upload and serve

**Files:**
- Create: `src/app/api/gold/upload/route.ts`
- Create: `src/app/api/gold/image/[filename]/route.ts`

- [ ] **Step 1: Write `upload/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { requireUserId } from "@/lib/session";

const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 5 MB" }, { status: 400 });
  if (!VALID_TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1] || "bin";
  const name = `${randomBytes(10).toString("hex")}.${ext}`;
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "gold");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);

  return NextResponse.json({ url: `/api/gold/image/${name}` });
}
```

- [ ] **Step 2: Write `image/[filename]/route.ts`**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "gold");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!/^[a-f0-9]+\.(jpeg|jpg|png|gif|webp)$/.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(join(UPLOAD_DIR, filename));
    const ext = filename.split(".").pop()!;
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Manual verification**

With dev server running and logged in:

```bash
curl -i -X POST -b "..." -F "file=@/path/to/some.jpg" http://localhost:3000/api/gold/upload
```

Expected: 201/200 response with `{ url: "/api/gold/image/<hex>.jpg" }`. Opening that URL in the browser (while logged-in session is not required for image route, it's public by filename obfuscation just like FD) should render the image. Reject a PDF or a 6 MB file with 400.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/gold/upload src/app/api/gold/image
git commit -m "feat(gold): photo upload and serve endpoints"
```

---

## Task 8: Sidebar entry

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Add Gold entry**

In `src/components/sidebar.tsx`:
- Import `Coins` from `lucide-react` alongside the other icons.
- Add `{ href: "/dashboard/gold", label: "Gold", icon: Coins }` to the `navItems` array, placed after the Fixed Deposits entry.

Result should be:

```ts
import {
  LayoutDashboard,
  TrendingUp,
  Landmark,
  Coins,
  Settings,
  ChevronLeft,
  ChevronRight,
  LineChart,
} from "lucide-react";

// ...

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/zerodha", label: "Zerodha", icon: TrendingUp },
  { href: "/dashboard/fd", label: "Fixed Deposits", icon: Landmark },
  { href: "/dashboard/gold", label: "Gold", icon: Coins },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 2: Manual verification**

Reload dashboard. "Gold" appears in the sidebar with a coins icon. Clicking it navigates to `/dashboard/gold` (will 404 until Task 9). Do not commit a broken route — proceed to Task 9 before committing here? **Option A:** bundle sidebar change into Task 9's commit. Choose that. Skip commit here.

---

## Task 9: Gold list page (server component) + rate chip

**Files:**
- Create: `src/app/dashboard/gold/page.tsx`
- Create: `src/app/dashboard/gold/rate-chip.tsx`
- Create: `src/app/dashboard/gold/gold-list.tsx` (minimal placeholder this task; filled out in Task 10)

- [ ] **Step 1: Write `page.tsx`**

```tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram, type GoldRatePayload } from "@/lib/gold-rate";
import { GoldList } from "./gold-list";
import { RateChip } from "./rate-chip";

export default async function GoldPage() {
  const userId = (await getSessionUserId()) ?? "";
  const [items, rate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getTodaysRate(),
  ]);

  const enriched = items.map((item) => {
    let currentValue: number | null = null;
    let gainLoss: number | null = null;
    if (rate) {
      const perG = valuePerGram(item.karat, rate.rate22kPerG, rate.rate24kPerG);
      currentValue = perG * item.weightGrams;
      if (item.purchasePrice != null) gainLoss = currentValue - item.purchasePrice;
    }
    return { ...item, currentValue, gainLoss };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Gold</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track jewellery and see live Pune gold valuation.</p>
        </div>
        <RateChip initial={rate as GoldRatePayload | null} />
      </div>

      <GoldList initialItems={enriched} initialRate={rate} />
    </div>
  );
}
```

- [ ] **Step 2: Write `rate-chip.tsx`**

```tsx
"use client";

import { useState } from "react";
import { RefreshCw, Pencil } from "lucide-react";
import type { GoldRatePayload } from "@/lib/gold-rate";
import { ManualRateDialog } from "./manual-rate-dialog";

export function RateChip({ initial }: { initial: GoldRatePayload | null }) {
  const [rate, setRate] = useState<GoldRatePayload | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gold/rate/refresh", { method: "POST" });
      if (res.ok) setRate(await res.json());
    } finally {
      setRefreshing(false);
    }
  }

  const stale = !!rate?.staleAsOf;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className={
          "ab-chip " +
          (stale ? "ab-chip-warning" : "ab-chip-muted")
        }
        title={rate ? `source: ${rate.source}${stale ? " (stale)" : ""}` : "No rate available"}
      >
        {rate
          ? <>Pune · 22K ₹{Math.round(rate.rate22kPerG).toLocaleString("en-IN")}/g · 24K ₹{Math.round(rate.rate24kPerG).toLocaleString("en-IN")}/g · as of {rate.date}</>
          : <>No rate yet</>
        }
      </div>
      <button onClick={refresh} disabled={refreshing} className="ab-btn ab-btn-ghost" title="Refresh rate">
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
      </button>
      <button onClick={() => setManualOpen(true)} className="ab-btn ab-btn-ghost" title="Set manual rate">
        <Pencil size={14} /> Manual
      </button>
      {manualOpen && (
        <ManualRateDialog
          current={rate}
          onClose={() => setManualOpen(false)}
          onSaved={(r) => setRate(r)}
          onCleared={async () => {
            const res = await fetch("/api/gold/rate");
            if (res.ok) setRate(await res.json());
          }}
        />
      )}
    </div>
  );
}
```

(If `ab-chip-warning` does not exist in `globals.css`, fall back to `ab-chip ab-chip-accent` for the stale state.)

- [ ] **Step 3: Write placeholder `gold-list.tsx`**

```tsx
"use client";

import type { GoldItem } from "@prisma/client";
import type { GoldRatePayload } from "@/lib/gold-rate";

export type GoldRow = GoldItem & { currentValue: number | null; gainLoss: number | null };

export function GoldList({
  initialItems,
}: {
  initialItems: GoldRow[];
  initialRate: GoldRatePayload | null;
}) {
  if (initialItems.length === 0) {
    return <div className="ab-card p-10 text-center text-[#a0a0a5]">No jewellery yet.</div>;
  }
  return (
    <div className="ab-card p-4">
      <pre className="text-[12px] text-[#a0a0a5] overflow-auto">{JSON.stringify(initialItems, null, 2)}</pre>
    </div>
  );
}
```

(Placeholder; filled out in Task 10.)

- [ ] **Step 4: Manual verification**

Reload `/dashboard/gold`. Expected: header, rate chip with today's rate and manual button, and either the empty state or a JSON dump of items.

- [ ] **Step 5: Commit (bundles sidebar from Task 8)**

```bash
git add src/components/sidebar.tsx src/app/dashboard/gold
git commit -m "feat(gold): sidebar entry and list page scaffold"
```

---

## Task 10: Add/Edit item dialog

**Files:**
- Create: `src/app/dashboard/gold/gold-form-dialog.tsx`

- [ ] **Step 1: Write dialog**

```tsx
"use client";

import { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import type { GoldItem } from "@prisma/client";

type Input = {
  title: string;
  weightGrams: string;
  karat: "24" | "22" | "18" | "14";
  purchasePrice: string;
  purchasedOn: string;
  purchasedFrom: string;
  notes: string;
  photoUrl: string | null;
};

function toInput(item?: GoldItem | null): Input {
  return {
    title: item?.title ?? "",
    weightGrams: item?.weightGrams?.toString() ?? "",
    karat: (item?.karat?.toString() as Input["karat"]) ?? "22",
    purchasePrice: item?.purchasePrice?.toString() ?? "",
    purchasedOn: item?.purchasedOn ? new Date(item.purchasedOn).toISOString().slice(0, 10) : "",
    purchasedFrom: item?.purchasedFrom ?? "",
    notes: item?.notes ?? "",
    photoUrl: item?.photoUrl ?? null,
  };
}

export function GoldFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: GoldItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<Input>(() => toInput(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setInput(toInput(initial)), [initial]);

  function update<K extends keyof Input>(key: K, value: Input[K]) {
    setInput((s) => ({ ...s, [key]: value }));
  }

  async function handlePhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gold/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      update("photoUrl", data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: input.title.trim(),
        weightGrams: Number(input.weightGrams),
        karat: Number(input.karat),
        photoUrl: input.photoUrl,
        purchasePrice: input.purchasePrice === "" ? null : Number(input.purchasePrice),
        purchasedOn: input.purchasedOn || null,
        purchasedFrom: input.purchasedFrom.trim() || null,
        notes: input.notes.trim() || null,
      };
      const res = initial
        ? await fetch(`/api/gold/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`/api/gold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ab-card w-full max-w-[520px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#ededed]">{initial ? "Edit jewellery" : "Add jewellery"}</h2>
          <button onClick={onClose} className="ab-btn ab-btn-ghost"><X size={16} /></button>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Title *
          <input className="ab-input mt-1 w-full" value={input.title} onChange={(e) => update("title", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-[#a0a0a5]">Weight (g) *
            <input type="number" step="0.001" min="0" className="ab-input mt-1 w-full" value={input.weightGrams} onChange={(e) => update("weightGrams", e.target.value)} />
          </label>
          <label className="block text-[12px] text-[#a0a0a5]">Karat *
            <select className="ab-input mt-1 w-full" value={input.karat} onChange={(e) => update("karat", e.target.value as Input["karat"])}>
              <option value="24">24K</option>
              <option value="22">22K</option>
              <option value="18">18K</option>
              <option value="14">14K</option>
            </select>
          </label>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Purchase price (₹)
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={input.purchasePrice} onChange={(e) => update("purchasePrice", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-[#a0a0a5]">Purchased on
            <input type="date" className="ab-input mt-1 w-full" value={input.purchasedOn} onChange={(e) => update("purchasedOn", e.target.value)} />
          </label>
          <label className="block text-[12px] text-[#a0a0a5]">Purchased from
            <input className="ab-input mt-1 w-full" value={input.purchasedFrom} onChange={(e) => update("purchasedFrom", e.target.value)} />
          </label>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Notes
          <textarea rows={3} className="ab-input mt-1 w-full" value={input.notes} onChange={(e) => update("notes", e.target.value)} />
        </label>

        <div className="space-y-2">
          <div className="text-[12px] text-[#a0a0a5]">Photo</div>
          {input.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={input.photoUrl} alt="" className="h-24 rounded object-cover" />
          )}
          <label className="ab-btn ab-btn-ghost inline-flex cursor-pointer">
            <Upload size={14} /> {input.photoUrl ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          </label>
          {input.photoUrl && (
            <button type="button" className="ab-btn ab-btn-ghost ml-2" onClick={() => update("photoUrl", null)}>Remove photo</button>
          )}
          {uploading && <p className="text-[12px] text-[#a0a0a5]">Uploading…</p>}
        </div>

        {error && <p className="text-[12px] text-[#ff6b7a]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="ab-btn ab-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ab-btn ab-btn-accent" onClick={save} disabled={saving || !input.title || !input.weightGrams}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/gold/gold-form-dialog.tsx
git commit -m "feat(gold): add/edit item dialog"
```

---

## Task 11: Manual rate override dialog

**Files:**
- Create: `src/app/dashboard/gold/manual-rate-dialog.tsx`

- [ ] **Step 1: Write dialog**

```tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GoldRatePayload } from "@/lib/gold-rate";

export function ManualRateDialog({
  current,
  onClose,
  onSaved,
  onCleared,
}: {
  current: GoldRatePayload | null;
  onClose: () => void;
  onSaved: (r: GoldRatePayload) => void;
  onCleared: () => void;
}) {
  const [r22, setR22] = useState(current?.rate22kPerG?.toString() ?? "");
  const [r24, setR24] = useState(current?.rate24kPerG?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/gold/rate/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate22kPerG: Number(r22), rate24kPerG: Number(r24) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/gold/rate/manual", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      onCleared();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ab-card w-full max-w-[420px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#ededed]">Set today's gold rate</h2>
          <button onClick={onClose} className="ab-btn ab-btn-ghost"><X size={16} /></button>
        </div>
        <label className="block text-[12px] text-[#a0a0a5]">22K ₹ per gram
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={r22} onChange={(e) => setR22(e.target.value)} />
        </label>
        <label className="block text-[12px] text-[#a0a0a5]">24K ₹ per gram
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={r24} onChange={(e) => setR24(e.target.value)} />
        </label>
        {error && <p className="text-[12px] text-[#ff6b7a]">{error}</p>}
        <div className="flex justify-between gap-2 pt-2">
          <button className="ab-btn ab-btn-ghost" onClick={clear} disabled={busy}>Clear override</button>
          <div className="flex gap-2">
            <button className="ab-btn ab-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ab-btn ab-btn-accent" onClick={save} disabled={busy || !(Number(r22) > 0) || !(Number(r24) > 0)}>Save override</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Reload `/dashboard/gold`. Click "Manual", enter values, Save. Chip should update to `source: manual`. Clear override — chip reverts to scraped value.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/gold/manual-rate-dialog.tsx
git commit -m "feat(gold): manual rate override dialog"
```

---

## Task 12: Fill out gold list UI (summary + table)

**Files:**
- Modify: `src/app/dashboard/gold/gold-list.tsx`

- [ ] **Step 1: Replace placeholder with full UI**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { GoldItem } from "@prisma/client";
import type { GoldRatePayload } from "@/lib/gold-rate";
import { GoldFormDialog } from "./gold-form-dialog";

export type GoldRow = GoldItem & { currentValue: number | null; gainLoss: number | null };

export function GoldList({
  initialItems,
  initialRate,
}: {
  initialItems: GoldRow[];
  initialRate: GoldRatePayload | null;
}) {
  const [items, setItems] = useState<GoldRow[]>(initialItems);
  const [editing, setEditing] = useState<GoldItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const summary = useMemo(() => {
    const active = items.filter((i) => !i.disabled);
    const totalWeight = active.reduce((s, i) => s + i.weightGrams, 0);
    const withPrice = active.filter((i) => i.purchasePrice != null);
    const invested = withPrice.reduce((s, i) => s + (i.purchasePrice ?? 0), 0);
    const currentValue = active.reduce((s, i) => s + (i.currentValue ?? 0), 0);
    const gainLossItems = withPrice.reduce((s, i) => s + (i.gainLoss ?? 0), 0);
    const gainLossPct = invested > 0 ? (gainLossItems / invested) * 100 : 0;
    return { count: active.length, totalWeight, invested, currentValue, gainLoss: gainLossItems, gainLossPct };
  }, [items]);

  async function reload() {
    const res = await fetch("/api/gold");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this jewellery item?")) return;
    const res = await fetch(`/api/gold/${id}`, { method: "DELETE" });
    if (res.ok) setItems((xs) => xs.filter((x) => x.id !== id));
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <>
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Items", value: String(summary.count) },
            { label: "Total Weight", value: `${summary.totalWeight.toFixed(2)} g` },
            { label: "Invested", value: summary.invested > 0 ? formatINR(summary.invested) : "—" },
            { label: "Current Value", value: initialRate ? formatINR(summary.currentValue) : "—" },
            {
              label: "Gain / Loss",
              value: summary.invested > 0 && initialRate
                ? `${formatINR(summary.gainLoss)} (${summary.gainLossPct.toFixed(2)}%)`
                : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="ab-card p-4">
              <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="mono text-[18px] font-semibold text-[#ededed]">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="ab-btn ab-btn-accent"
        >
          <Plus size={15} /> Add jewellery
        </button>
      </div>

      {items.length === 0 ? (
        <div className="ab-card p-10 text-center text-[#a0a0a5]">No jewellery yet. Click "Add jewellery" to get started.</div>
      ) : (
        <div className="ab-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-[#a0a0a5] uppercase tracking-wider">
              <tr className="border-b border-[#1f1f23]">
                <th className="w-[30px]"></th>
                <th className="text-left p-3">Photo</th>
                <th className="text-left p-3">Title</th>
                <th className="text-right p-3">Weight (g)</th>
                <th className="text-right p-3">Karat</th>
                <th className="text-right p-3">Current Value</th>
                <th className="text-right p-3">Gain / Loss</th>
                <th className="w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const open = expanded.has(item.id);
                return (
                  <>
                    <tr key={item.id} className="border-b border-[#1f1f23] hover:bg-[#15151a]">
                      <td className="p-3">
                        <button onClick={() => toggle(item.id)} className="text-[#a0a0a5]">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="p-3">
                        {item.photoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={item.photoUrl} alt="" className="h-10 w-10 rounded object-cover" />
                          : <div className="h-10 w-10 rounded bg-[#15151a]" />}
                      </td>
                      <td className="p-3 text-[#ededed]">{item.title}</td>
                      <td className="p-3 mono text-right">{item.weightGrams.toFixed(2)}</td>
                      <td className="p-3 mono text-right">{item.karat}K</td>
                      <td className="p-3 mono text-right">{item.currentValue != null ? formatINR(item.currentValue) : "—"}</td>
                      <td className={"p-3 mono text-right " + (item.gainLoss == null ? "" : item.gainLoss >= 0 ? "text-[#5ee0a4]" : "text-[#ff6b7a]")}>
                        {item.gainLoss != null ? formatINR(item.gainLoss) : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <button className="ab-btn ab-btn-ghost" onClick={() => { setEditing(item); setDialogOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="ab-btn ab-btn-ghost ml-1" onClick={() => remove(item.id)} title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                    {open && (
                      <tr key={item.id + "-detail"} className="border-b border-[#1f1f23] bg-[#0f0f12]">
                        <td></td>
                        <td colSpan={7} className="p-4 text-[12px] text-[#a0a0a5] space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><span className="text-[#6c6c73]">Purchased on:</span> {item.purchasedOn ? new Date(item.purchasedOn).toLocaleDateString("en-IN") : "—"}</div>
                            <div><span className="text-[#6c6c73]">From:</span> {item.purchasedFrom ?? "—"}</div>
                            <div><span className="text-[#6c6c73]">Purchase price:</span> {item.purchasePrice != null ? formatINR(item.purchasePrice) : "—"}</div>
                            <div><span className="text-[#6c6c73]">Added:</span> {new Date(item.createdAt).toLocaleDateString("en-IN")}</div>
                          </div>
                          {item.notes && <div className="whitespace-pre-wrap">{item.notes}</div>}
                          {item.photoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photoUrl} alt="" className="max-h-60 rounded" />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <GoldFormDialog
          initial={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Manual verification**

End-to-end check on `/dashboard/gold`:
1. Empty state renders.
2. Add item (title, weight 10, karat 22, purchase price 70000) — row appears with current value (10 × 22K rate) and gain/loss vs 70000.
3. Expand row — details render; add notes/photo in edit, confirm render.
4. Change karat to 24 via edit — current value updates after reload.
5. Delete row — removed, photo file gone from `public/uploads/gold`.
6. Summary cards totals match the single row (and recompute with a second row).
7. If no rate is available (temporarily block network then reload), Current Value shows "—" and no crash.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/gold/gold-list.tsx
git commit -m "feat(gold): summary row and items table with inline detail"
```

---

## Task 13: Overview dashboard "Gold" card

**Files:**
- Modify: `src/app/dashboard/overview-client.tsx` (or `src/app/dashboard/page.tsx`; confirm which owns the overview cards by reading it first)

- [ ] **Step 1: Read the overview file and locate the cards grid**

Run:
```bash
grep -n "FD\|Fixed Deposits\|Overview" src/app/dashboard/page.tsx src/app/dashboard/overview-client.tsx | head -40
```

Identify where the FD summary card is rendered (by label or component). Add a sibling "Gold" card next to it.

- [ ] **Step 2: Compute Gold totals in the overview server component**

Before rendering the client overview, add:

```ts
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

const goldItems = await prisma.goldItem.findMany({ where: { userId: userId ?? "", disabled: false } });
const goldRate = await getTodaysRate();
const goldTotals = (() => {
  let currentValue = 0;
  let invested = 0;
  for (const it of goldItems) {
    if (goldRate) currentValue += valuePerGram(it.karat, goldRate.rate22kPerG, goldRate.rate24kPerG) * it.weightGrams;
    if (it.purchasePrice != null) invested += it.purchasePrice;
  }
  return { count: goldItems.length, currentValue, invested, gainLoss: invested > 0 ? currentValue - invested : null };
})();
```

Pass `goldTotals` (and a link `/dashboard/gold`) to the overview client component; render a card mirroring the FD card with:
- Label: "Gold"
- Primary value: `formatINR(goldTotals.currentValue)` (or "—" when no rate)
- Secondary: `${goldTotals.count} items` + gain/loss chip (green/red) when `gainLoss != null`
- Whole card is a link to `/dashboard/gold`

- [ ] **Step 3: Manual verification**

Open `/dashboard`. Expected: a Gold card with current value and item count, clickable to the gold page, matching the totals shown on the gold list page.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/overview-client.tsx
git commit -m "feat(gold): summary card on overview dashboard"
```

---

## Task 14: Final end-to-end sanity and build

- [ ] **Step 1: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors. Fix any surfaced type issues before proceeding.

- [ ] **Step 2: Production build**

Run:
```bash
npm run build
```

Expected: build succeeds with no errors. Warnings about images (using `<img>`) are acceptable — the codebase already uses that pattern.

- [ ] **Step 3: Full-flow manual smoke**

With `npm run dev`:
1. Sidebar: click Gold → list loads, rate chip populated.
2. Add jewellery with a photo + purchase price → appears in list, summary updates.
3. Edit item: change karat → current value updates after save.
4. Set manual rate → chip shows "manual" source; list values recompute after reload.
5. Clear manual rate → chip reverts to scraped source.
6. Delete item → row removed; confirm photo file removed from `public/uploads/gold`.
7. Overview dashboard: Gold card shows matching totals.
8. Log out → `/dashboard/gold` redirects to login.

- [ ] **Step 4: Verify no stray uncommitted changes**

Run:
```bash
git status
```

Expected: clean working tree.

---

## Self-Review Notes

- Spec coverage checked: Prisma models (Task 1), cheerio dep (Task 2), rate service incl. stale fallback and manual override (Task 3), all API routes (Tasks 4–7), sidebar (Task 8), rate chip + manual dialog (Tasks 9, 11), add/edit dialog (Task 10), summary + table (Task 12), overview card (Task 13), final verification (Task 14). No spec requirement without a task.
- No placeholders, "similar to Task N", or "handle edge cases" hand-waves.
- Type consistency: `GoldRatePayload` defined once in Task 3, imported by Tasks 4, 9, 11, 13. `GoldRow` defined in Task 9 placeholder, same shape used in Task 12. `valuePerGram(karat, rate22k, rate24k)` signature identical in Tasks 3, 5, 9, 13.
