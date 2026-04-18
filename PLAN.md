# Personal Investment Tracker — Implementation Plan

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Full-stack in one repo, API routes, file uploads |
| Language | TypeScript | Type safety across frontend + backend |
| Database | Turso (libSQL) + Prisma ORM | Hosted SQLite-compatible, free tier, edge-ready |
| UI | Shadcn/UI + Tailwind CSS | Accessible, composable, easy to theme |
| Charts | Recharts | Lightweight, composable React charts |
| Kite SDK | `kiteconnect` (npm) | Official Zerodha Node.js SDK |
| FD Extraction | Claude Vision API (Sonnet 4.6) | Structured JSON from photos/PDFs, ~$0.005/image |
| Auth | NextAuth.js (local credentials) | Simple password-protected personal app |

---

## Design Language

**Theme:** Dark-first dashboard. Deep navy/slate background (`#0F1117`), card surfaces in `#1A1D27`, accent in indigo/violet (`#6366F1`). Clean, minimal chrome — content-first.

**Typography:** Inter (system-ui fallback). Large metric numbers in a tabular-nums mono variant for clean alignment.

**Motion:** Subtle fade-in on page load, number counters animate on mount, chart draws in on load (Recharts animation).

**Layout:** Sidebar navigation (collapsible on mobile) + main content area. Cards with soft shadows, no harsh borders — use background contrast instead.

**Color system:**
- Positive P&L / gains → `#22C55E` (green-500)
- Negative P&L / loss → `#EF4444` (red-500)
- Neutral / info → `#6366F1` (indigo-500)
- Warning / upcoming maturity → `#F59E0B` (amber-500)

---

## Phase 0: Documentation Discovery ✅

### Kite Connect v3
- Auth: API key → redirect to Kite login → receive `request_token` → POST
  checksum `SHA-256(api_key + request_token + api_secret)` to `/session/token` → get `access_token` (valid 1 day)
- SDK: `npm install kiteconnect` (official, Node 18+)
- Key methods: `getHoldings()`, `getPositions()`, `getProfile()`, `getMargins()`
- Rate limits: 10 req/sec for portfolio endpoints
- No sandbox — requires live Zerodha account
- Source: https://kite.trade/docs/connect/v3/

### Claude Vision API
- Send image (base64) + text prompt → structured JSON matching provided schema
- Supported formats: JPEG, PNG, GIF, WebP
- Max file size: 5 MB
- Cost: ~$0.003–$0.006 per FD document (negligible for personal use)
- Source: https://platform.claude.com/docs/en/build-with-claude/vision

---

## Phase 1: Project Scaffolding & Database Schema

**Goal:** Working Next.js app with DB schema, design tokens, and navigation shell.

### Tasks

1. **Init project**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --src-dir
   npx shadcn@latest init
   npx shadcn@latest add card button badge table tabs skeleton dialog form input label separator
   ```

2. **Install dependencies**
   ```bash
   npm install prisma @prisma/client @prisma/adapter-libsql @libsql/client
   npm install kiteconnect @anthropic-ai/sdk
   npm install next-auth @auth/prisma-adapter
   npm install recharts date-fns lucide-react
   npm install react-dropzone
   npm install -D @types/node
   ```

3. **Tailwind theme** (`tailwind.config.ts`) — extend with custom colors matching design language above

4. **Prisma schema** (`prisma/schema.prisma`)
   ```prisma
   model FixedDeposit {
     id             String   @id @default(cuid())
     bankName       String
     fdNumber       String?
     accountNumber  String?
     principal      Float
     interestRate   Float        // % per annum
     tenureMonths   Int
     startDate      DateTime
     maturityDate   DateTime
     maturityAmount Float?
     interestType   String       // "simple" | "compound"
     compoundFreq   String?      // "quarterly" | "monthly" | "annually"
     notes          String?
     sourceImageUrl String?
     createdAt      DateTime     @default(now())
     updatedAt      DateTime     @updatedAt
   }

   model KiteConfig {
     id          String    @id @default("singleton")
     apiKey      String
     apiSecret   String
     accessToken String?
     tokenExpiry DateTime?
     updatedAt   DateTime  @updatedAt
   }
   ```

5. **App shell** — sidebar with routes: Overview, Zerodha, Fixed Deposits, Settings
   - Collapsible sidebar on mobile (hamburger)
   - Active route highlight
   - Logo / app name at top of sidebar

6. **Prisma config for Turso** (`prisma/schema.prisma`)
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("TURSO_DATABASE_URL")
   }

   generator client {
     provider        = "prisma-client-js"
     previewFeatures = ["driverAdapters"]
   }
   ```

7. **Prisma client singleton** (`src/lib/prisma.ts`)
   ```typescript
   import { PrismaClient } from "@prisma/client";
   import { PrismaLibSQL } from "@prisma/adapter-libsql";
   import { createClient } from "@libsql/client";

   const libsql = createClient({
     url: process.env.TURSO_DATABASE_URL!,
     authToken: process.env.TURSO_AUTH_TOKEN!,
   });
   const adapter = new PrismaLibSQL(libsql);
   export const prisma = new PrismaClient({ adapter });
   ```

8. **Run** `npx prisma db push` (Turso uses `db push`, not `migrate dev`)

### Verification
- `npx prisma studio` connects to Turso and shows tables
- `npm run dev` loads shell with sidebar navigation
- All shadcn components render without errors

---

## Phase 2: Kite Connect Integration

**Goal:** Connect Zerodha account, display live holdings and positions with P&L.

**Doc reference:** https://kite.trade/docs/connect/v3/connect/#login-flow

### Tasks

1. **Settings page** — form to save `api_key` + `api_secret` to `KiteConfig` table

2. **Login flow**
   - `GET /api/kite/login` — redirect to `https://kite.zerodha.com/connect/login?api_key=xxx&v=3`
   - `GET /api/kite/callback` — receive `request_token`, call `kc.generateSession(request_token, api_secret)`, save `access_token` to DB

3. **Portfolio routes**
   - `GET /api/kite/holdings` → `kc.getHoldings()`
   - `GET /api/kite/positions` → `kc.getPositions()`

4. **Zerodha page** (`/dashboard/zerodha`)

   **Holdings table columns:**
   | Symbol | Qty | Avg Cost | LTP | Current Value | P&L | P&L % |
   - Color-coded P&L (green/red)
   - Sortable columns
   - Search/filter by symbol

   **Positions section:**
   - Day positions with unrealised P&L
   - Net positions summary

   **Summary bar (top of page):**
   - Total invested (equity)
   - Current value
   - Overall P&L + P&L %
   - Day's change

5. **Token expiry guard** — if `tokenExpiry < now`, show reconnect banner instead of data

### Verification
- Full connect flow works end-to-end
- Holdings table renders with correct values
- P&L numbers match Zerodha app

### Anti-patterns
- Do NOT cache `access_token` past midnight (Zerodha invalidates daily at ~03:30 IST)
- Do NOT expose `api_secret` in client-side code

---

## Phase 3: Fixed Deposit — Upload, Extraction & Management

**Goal:** Upload FD document → Claude extracts details → user reviews/edits → saved to DB.

### Tasks

1. **Upload & extract endpoint** (`POST /api/fd/extract`)
   ```typescript
   // Accept multipart/form-data image
   // Convert to base64
   const response = await anthropic.messages.create({
     model: "claude-sonnet-4-6",
     max_tokens: 1024,
     messages: [{
       role: "user",
       content: [
         { type: "image", source: { type: "base64", media_type, data: base64 } },
         { type: "text", text: `Extract Fixed Deposit details as JSON matching this schema exactly:
           { bankName, fdNumber, accountNumber, principal, interestRate, tenureMonths,
             startDate (YYYY-MM-DD), maturityDate (YYYY-MM-DD), maturityAmount,
             interestType ("simple"|"compound"), compoundFreq ("monthly"|"quarterly"|"annually"|null) }` }
       ]
     }]
   });
   // Parse and return JSON
   ```

2. **FD CRUD routes**
   - `POST /api/fd` — create FD record
   - `GET /api/fd` — list all FDs
   - `PATCH /api/fd/[id]` — update FD
   - `DELETE /api/fd/[id]` — delete FD

3. **Add FD page** (`/dashboard/fd/new`)
   - Drag-and-drop upload zone (react-dropzone) with camera icon, dashed border
   - File size check (< 5 MB) before upload
   - Loading state: spinner + "Extracting details with AI..."
   - Pre-filled review form with all extracted fields — all editable
   - Date pickers for start/maturity date
   - "Save FD" → POST to `/api/fd`
   - Option to skip upload and fill manually

4. **FD list page** (`/dashboard/fd`)
   - Card grid (2 cols desktop, 1 col mobile) per FD:
     - Bank name + FD number
     - Principal amount (large)
     - Interest rate badge
     - Start → Maturity date with progress bar (% of tenure elapsed)
     - Days to maturity (amber warning if < 30 days, red if < 7 days)
     - Maturity amount
   - Status filter tabs: All / Active / Matured
   - "Add FD" button (top right)

### Verification
- Upload FD image → extracted JSON contains correct bank, rate, dates
- All fields editable before saving
- FD card renders with correct progress bar and maturity countdown

### Anti-patterns
- Do NOT auto-save without user review step
- Do NOT send images > 5 MB — validate client-side before upload

---

## Phase 4: Analytics & Insights

**Goal:** Rich analytics combining Zerodha equity + Fixed Deposits.

### Analytics to compute

#### Fixed Deposit Analytics
| Metric | Formula |
|---|---|
| Total FD Principal | `SUM(principal)` |
| Total Maturity Value | `SUM(maturityAmount)` |
| Total Interest to be Earned | `SUM(maturityAmount - principal)` |
| Interest Earned This Year | Pro-rata interest accrued in current calendar year per FD |
| Interest Accrued Till Today | Days elapsed / total days × total interest per FD |
| Upcoming Maturities | FDs maturing in next 30 / 90 days |
| Weighted Avg Interest Rate | `SUM(principal × rate) / SUM(principal)` |

**Interest earned this year (per FD):**
```
yearStart = Jan 1 of current year
yearEnd = Dec 31 of current year (or maturity if earlier)
daysInYear = overlap of (yearStart..yearEnd) with (startDate..maturityDate)
interest_this_year = (principal × rate / 100) × (daysInYear / 365)
```

#### Equity Analytics (from Kite)
| Metric | Value |
|---|---|
| Total Invested | `SUM(avg_price × qty)` |
| Current Value | `SUM(ltp × qty)` |
| Overall P&L | `current_value - total_invested` |
| Overall P&L % | `(P&L / total_invested) × 100` |

#### Combined Portfolio Analytics
| Metric | Formula |
|---|---|
| Total Portfolio Value | `equity_current_value + fd_maturity_value` |
| Total Capital Deployed | `equity_invested + fd_principal` |
| Portfolio CAGR | `((total_portfolio_value / total_capital) ^ (1 / years)) - 1` where years = weighted avg holding period |
| Asset Allocation % | `equity % vs FD %` of total portfolio |

### Tasks

1. **Analytics computation** (`src/lib/analytics.ts`)
   - Pure functions, fully typed, no DB calls — accept data arrays, return computed metrics
   - Unit-testable

2. **Overview dashboard** (`/dashboard`)

   **Top row — 4 summary cards:**
   - Total Portfolio Value
   - Total Capital Deployed
   - Overall P&L (equity)
   - Portfolio CAGR

   **Middle row:**
   - Asset Allocation donut chart (Equity vs FD)
   - Interest earned this year vs projected (bar chart)

   **Bottom row:**
   - FD interest accrual timeline (area chart — cumulative interest over time)
   - Top holdings by value (horizontal bar)
   - Upcoming FD maturities (list)

3. **FD analytics card** (inside `/dashboard/fd`)
   - Interest earned so far this year
   - Projected interest for full year
   - Average rate across all FDs
   - Total corpus at maturity

### Verification
- Interest this year calculation verified manually against one FD
- CAGR formula verified with known inputs
- Charts render with real data

---

## Phase 5: Settings & Configuration

### Tasks

1. **Zerodha section** — enter/update API key + secret, show connection status (connected/disconnected), disconnect button

2. **Claude API key** — stored in `.env.local` as `ANTHROPIC_API_KEY`

3. **App password** — optional NextAuth local credentials gate

4. **`.env.local` template** (committed as `.env.example`)
   ```
   TURSO_DATABASE_URL=libsql://your-db-name.turso.io
   TURSO_AUTH_TOKEN=your-turso-auth-token
   ANTHROPIC_API_KEY=sk-ant-...
   NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
   ```

---

## Phase 6: Polish & UX

### Tasks

1. **Loading states** — skeleton cards on every data fetch (no blank flashes)
2. **Empty states** — illustrated empty state for no FDs, no holdings (with CTA)
3. **Error handling** — toast notifications for API errors, Kite token expiry banner
4. **Responsive layout** — sidebar collapses to bottom nav on mobile
5. **Number formatting** — `₹1,23,456` Indian locale formatting throughout
6. **Animated counters** — portfolio value cards count up on mount
7. **`npm run build`** — zero TypeScript errors before shipping

---

## File Structure

```
src/
  app/
    dashboard/
      page.tsx                   # Overview + analytics
      zerodha/page.tsx           # Holdings + positions
      fd/
        page.tsx                 # FD list + analytics
        new/page.tsx             # Upload + extract + confirm
    api/
      kite/
        login/route.ts
        callback/route.ts
        holdings/route.ts
        positions/route.ts
      fd/
        extract/route.ts         # Claude vision extraction
        route.ts                 # GET list, POST create
        [id]/route.ts            # PATCH update, DELETE
    settings/page.tsx
    layout.tsx                   # Sidebar shell
  components/
    sidebar.tsx
    holdings-table.tsx
    fd-card.tsx
    fd-upload-zone.tsx
    portfolio-summary-cards.tsx
    allocation-chart.tsx
    interest-timeline-chart.tsx
    maturity-list.tsx
    animated-counter.tsx
  lib/
    kite.ts                      # KiteConnect singleton
    anthropic.ts                 # Anthropic client singleton
    prisma.ts                    # Prisma client singleton
    analytics.ts                 # Pure analytics computation functions
    format.ts                    # ₹ formatting, date formatting
prisma/
  schema.prisma
  migrations/
.env.example
```

---

## Execution Order

| Phase | Effort | Depends On |
|---|---|---|
| 1 — Scaffold + Schema + Shell | ~1.5h | — |
| 2 — Kite Integration | ~2h | Phase 1 |
| 3 — FD Upload + Extraction | ~2h | Phase 1 |
| 4 — Analytics & Charts | ~2h | Phases 2 + 3 |
| 5 — Settings | ~0.5h | Phases 2 + 3 |
| 6 — Polish | ~1h | Phase 4 |

**Total estimate: ~9h**
