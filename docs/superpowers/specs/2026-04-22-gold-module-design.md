# Gold Module — Design

**Date:** 2026-04-22
**Status:** Approved for planning

## 1. Summary

Add a "Gold" module to the personal investment tracker for managing jewellery items and their current valuation. Gold rates (22K and 24K, per gram, INR) for Pune are scraped daily from goodreturns.in, cached in the database, and can be manually overridden. Each item shows current value and, when a purchase price is recorded, gain/loss.

## 2. Scope

### In scope
- CRUD for jewellery items with fields: title, weight (g), karat, optional photo, optional purchase price, optional purchased-on date, optional purchased-from, optional notes, disabled flag.
- Daily scrape of goodreturns.in Pune gold rates (22K + 24K per gram).
- Manual rate override per day.
- Per-item current valuation + gain/loss when purchase price is set.
- Gold summary card on overview dashboard.
- Sidebar entry.

### Out of scope (YAGNI)
- Multiple photos per item
- Making charges, stone weight, hallmark certificate storage
- Silver or other metals
- Historical price chart per item
- Bulk upload / OCR
- Selling / partial sell tracking

## 3. Data Model (Prisma)

```prisma
model GoldItem {
  id             String   @id @default(cuid())
  userId         String   @default("")
  title          String
  weightGrams    Float
  karat          Int                 // 24 | 22 | 18 | 14
  photoUrl       String?             // e.g. /api/gold/image/<filename>
  purchasedOn    DateTime?
  purchasedFrom  String?
  purchasePrice  Float?              // INR; enables gain/loss
  notes          String?
  disabled       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
}

model GoldRate {
  id           String   @id @default(cuid())
  date         DateTime            // date-only (UTC midnight)
  source       String              // "goodreturns-pune" | "manual"
  rate24kPerG  Float
  rate22kPerG  Float
  fetchedAt    DateTime @default(now())

  @@unique([date, source])
}
```

### Valuation rules

For a given item with `weightGrams` W and `karat` K, using the effective rate for today:

- 24K → `W × rate24kPerG`
- 22K → `W × rate22kPerG`
- 18K → `W × rate24kPerG × 0.750`
- 14K → `W × rate24kPerG × 0.583`
- Any other K (defensive) → `W × rate24kPerG × K/24`

`gainLoss = currentValue - purchasePrice` (only when `purchasePrice` is set).

## 4. Rate Fetch Service

Location: `src/lib/gold-rate.ts`.

### Functions

- `getTodaysRate()`
  - Look up `GoldRate` for today's UTC date. If both `manual` and `goodreturns-pune` rows exist, prefer `manual`.
  - If no row exists, call `scrapeGoodreturnsPune()`, insert, return.
  - If scrape fails and no row exists for today, return the most recent `GoldRate` row (any source) with a `staleAsOf: Date` field set to that row's `date`. If no rows exist at all, return `null`.

- `scrapeGoodreturnsPune()`
  - `fetch("https://www.goodreturns.in/gold-rates/pune.html")` with a browser-like `User-Agent`.
  - Parse HTML with `cheerio` to extract per-gram 22K and 24K INR values.
  - Returns `{ rate22kPerG: number, rate24kPerG: number }` or throws.

- `refreshTodaysRate()` — force re-scrape; upsert today's `goodreturns-pune` row.

- `setManualRate({ rate22kPerG, rate24kPerG })` — upsert today's `manual` row.

- `clearManualRate()` — delete today's `manual` row (falls back to scraped row).

### Dependency

Add `cheerio` to `package.json`.

## 5. API Routes

All routes gated by the existing session helper (`getSession()`), same pattern as `/api/fd/*`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/gold` | List items for current user, each enriched with `currentValue` and `gainLoss` (null when no purchase price) |
| POST | `/api/gold` | Create item |
| GET | `/api/gold/[id]` | Read single item |
| PATCH | `/api/gold/[id]` | Update item |
| DELETE | `/api/gold/[id]` | Delete item; best-effort unlink photo file |
| POST | `/api/gold/upload` | Upload photo (image types only, 5 MB cap) → `{ url }` |
| GET | `/api/gold/image/[filename]` | Serve photo file |
| GET | `/api/gold/rate` | Returns `{ date, rate22kPerG, rate24kPerG, source, staleAsOf? }`; triggers lazy fetch |
| POST | `/api/gold/rate/refresh` | Force scrape, returns updated rate payload |
| POST | `/api/gold/rate/manual` | Body: `{ rate22kPerG, rate24kPerG }`; upserts manual override for today |
| DELETE | `/api/gold/rate/manual` | Clears today's manual override |

### Photo upload

Mirror `src/app/api/fd/upload/route.ts`:
- Accept `image/jpeg`, `image/png`, `image/gif`, `image/webp` (no PDF).
- 5 MB limit.
- Write to `process.env.UPLOAD_DIR ?? public/uploads/gold/`.
- Return `/api/gold/image/<filename>`.

## 6. UI

### Sidebar

Add a "Gold" group (single entry "Items" linking to `/dashboard/gold`), matching the FD group pattern in `src/components/sidebar.tsx`.

### `/dashboard/gold` — list page

- **Header:**
  - Page title: "Gold".
  - Rate chip: "Pune · 22K ₹<x>/g · 24K ₹<y>/g · as of <date>" — amber styling when `staleAsOf` is set.
  - "Refresh" icon button (calls `/api/gold/rate/refresh`).
  - "Set manual rate" link → opens dialog.
- **Summary row (cards):**
  - Total items
  - Total weight (g)
  - Invested (sum of `purchasePrice` where set)
  - Current value (sum of `currentValue`)
  - Gain / Loss (₹ and %, computed only across items with purchase price)
- **Actions bar:** "Add jewellery" button (opens form dialog).
- **Items table:** columns — photo thumb, title, weight (g), karat, current value, gain/loss (— when no purchase price), actions (edit, delete).
- **Inline expand / drawer** per row: shows notes, purchased-on, purchased-from, full-size photo.
- **Empty state:** similar language/visuals to FD's empty state.

### Add / Edit dialog (one reusable component)

Fields:
- Title (required)
- Weight in grams (required, number)
- Karat (required, select: 24 / 22 / 18 / 14)
- Purchase price ₹ (optional, number)
- Purchased on (optional, date)
- Purchased from (optional, text)
- Notes (optional, textarea)
- Photo (optional, file input with preview and remove)

### Manual rate dialog

- Two number fields: 22K/g, 24K/g.
- Save Override (POSTs `/api/gold/rate/manual`).
- Clear Override (DELETEs `/api/gold/rate/manual`).

### Overview dashboard card

On `/dashboard`, add a "Gold" card mirroring the FD summary card: total current value, gain/loss, item count, and a link to `/dashboard/gold`.

## 7. Error Handling & Edge Cases

- **Scrape fails, no row for today:** UI shows last known rate with "As of <date>" badge in amber; valuations use that rate.
- **No rate ever fetched and scrape fails:** valuations show "—"; UI prompts to set manual rate or retry refresh.
- **Unsupported karat value in data (defensive):** fall back to `rate24kPerG × K/24`.
- **Photo upload failure:** item still saves without photo; toast error.
- **Delete item:** best-effort `unlink` of photo; ignore `ENOENT`.
- **Purchase price empty:** gain/loss cell shows "—"; item excluded from invested and gain/loss totals (but still counted in weight and current value).
- **Timezone:** "today" means UTC date for `GoldRate`, but UI "as of" label should render in local time.

## 8. Verification (manual)

No automated test harness exists in this project; verification is manual:

1. Create an item with and without photo, purchase price, and optional fields.
2. Edit an item — change karat and confirm valuation updates.
3. Delete an item — confirm photo file is removed from disk.
4. First load of the day triggers scrape; subsequent loads use cached row.
5. Manual override takes precedence over scraped row for the same day.
6. Block network and reload — UI shows stale badge with last known rate.
7. Overview dashboard "Gold" card totals match list totals.

## 9. Dependencies

- Add `cheerio` to `package.json`.
- No schema changes beyond the two new Prisma models.
