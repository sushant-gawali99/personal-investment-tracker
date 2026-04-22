# Bank Accounts Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `/dashboard/bank-accounts` module that imports PDF bank statements via Claude, categorizes transactions (rules-first + Claude fallback), auto-detects inter-account transfers, and renders five analysis views plus a filterable transaction list.

**Architecture:** New vertical slice. Five Prisma models (`BankAccount`, `TransactionCategory`, `Transaction`, `MerchantRule`, `StatementImport`). Pure TDD-ready utilities live under `src/lib/bank-accounts/` (normalize / dedup / rules / transfer-detect / aggregations). Upload pipeline: `pdf-parse` text extraction → Claude Haiku 4.5 (PDF document block, vision-capable) → staged `stagedTransactions` JSON on `StatementImport` → preview → commit (rules → insert → transfer-detect). UI wizard under `/dashboard/bank-accounts/import`, analytics pages using Recharts, transaction list under `/dashboard/bank-accounts/list`, and a sidebar nav entry labeled "Bank Accounts" using the `Wallet` icon.

**Tech Stack:** Next.js 16.2.4 (app router; route params are `Promise` — check `node_modules/next/dist/docs/` if route handler signatures surprise you), Prisma 7 with libSQL, `@anthropic-ai/sdk` (Claude Haiku 4.5), `pdf-parse` v2 (ESM, class-based, dynamic import), `vitest` 4 (already configured), `recharts` 3, `react-dropzone`, `date-fns` 4, shadcn + Base UI + project-local `ab-*` CSS classes. Existing utilities: `getSessionUserId`, `requireUserId` from `src/lib/session.ts`, `runWithConcurrency` from `src/lib/bulk-queue.ts`, file upload pattern from `src/app/api/fd/upload/route.ts`.

**Spec:** `docs/superpowers/specs/2026-04-22-bank-accounts-module-design.md`

**Conventions reconciled from spec:**
- Spec said "Decimal" — we use **Float** (consistent with `FixedDeposit`, `GoldItem`, `FDStatementTxn`).
- Spec said dates as "String (YYYY-MM-DD)" — we use **DateTime** (consistent with `FDStatementTxn.txnDate`). Comparisons use midnight local-day timestamps.
- Spec said "new dep `pdfjs-dist`" — **`pdf-parse` v2 is already installed** and works for both text extraction and is paired with Claude's document block for vision fallback. Do NOT add `pdfjs-dist`.
- Spec said "no test framework" — **vitest is present** at `vitest.config.ts`. Reuse it.

---

## File Structure

**Create (new)**
- `src/lib/bank-accounts/types.ts`
- `src/lib/bank-accounts/normalize-description.ts` (+ `.test.ts`)
- `src/lib/bank-accounts/dedup.ts` (+ `.test.ts`)
- `src/lib/bank-accounts/merchant-rules.ts` (+ `.test.ts`)
- `src/lib/bank-accounts/transfer-detect.ts` (+ `.test.ts`)
- `src/lib/bank-accounts/aggregations.ts` (+ `.test.ts`)
- `src/lib/bank-accounts/category-seed.ts`
- `src/lib/bank-accounts/extract-transactions-prompt.ts`
- `src/lib/bank-accounts/extract-transactions.ts`
- `src/lib/bank-accounts/pdf-text.ts`
- `src/lib/bank-accounts/categorize.ts`
- `src/lib/bank-accounts/cost-tracking.ts`
- `src/app/api/bank-accounts/accounts/route.ts`
- `src/app/api/bank-accounts/accounts/[id]/route.ts`
- `src/app/api/bank-accounts/categories/route.ts`
- `src/app/api/bank-accounts/categories/[id]/route.ts`
- `src/app/api/bank-accounts/rules/route.ts`
- `src/app/api/bank-accounts/rules/[id]/route.ts`
- `src/app/api/bank-accounts/transactions/route.ts`
- `src/app/api/bank-accounts/transactions/[id]/route.ts`
- `src/app/api/bank-accounts/transactions/categorize/route.ts`
- `src/app/api/bank-accounts/import/upload/route.ts`
- `src/app/api/bank-accounts/import/[id]/route.ts`
- `src/app/api/bank-accounts/import/[id]/extract/route.ts`
- `src/app/api/bank-accounts/import/[id]/commit/route.ts`
- `src/app/api/bank-accounts/analytics/summary/route.ts`
- `src/app/api/bank-accounts/analytics/categories/route.ts`
- `src/app/api/bank-accounts/analytics/merchants/route.ts`
- `src/app/dashboard/bank-accounts/page.tsx` (overview, views A–E)
- `src/app/dashboard/bank-accounts/overview-client.tsx`
- `src/app/dashboard/bank-accounts/list/page.tsx`
- `src/app/dashboard/bank-accounts/list/transactions-table.tsx`
- `src/app/dashboard/bank-accounts/accounts/page.tsx`
- `src/app/dashboard/bank-accounts/accounts/accounts-client.tsx`
- `src/app/dashboard/bank-accounts/categories/page.tsx`
- `src/app/dashboard/bank-accounts/categories/categories-client.tsx`
- `src/app/dashboard/bank-accounts/imports/page.tsx`
- `src/app/dashboard/bank-accounts/imports/imports-list.tsx`
- `src/app/dashboard/bank-accounts/import/page.tsx`
- `src/app/dashboard/bank-accounts/import/[id]/page.tsx`
- `src/app/dashboard/bank-accounts/import/import-wizard.tsx`
- `src/components/bank-accounts/month-picker.tsx`
- `src/components/bank-accounts/stat-cards.tsx`
- `src/components/bank-accounts/category-breakdown-chart.tsx`
- `src/components/bank-accounts/month-trend-chart.tsx`
- `src/components/bank-accounts/top-merchants-list.tsx`
- `src/components/bank-accounts/daily-heatmap.tsx`
- `src/components/bank-accounts/income-expense-chart.tsx`
- `src/components/bank-accounts/category-cell.tsx`
- `src/components/bank-accounts/transfer-badge.tsx`
- `prisma/seeds/preset-categories.ts`

**Modify**
- `prisma/schema.prisma` — five new models + back-relations.
- `src/components/sidebar.tsx` — add "Bank Accounts" nav entry.
- `package.json` — add `"db:seed:categories"` script if none exists.

---

## Task 0: Sanity-check existing infra

**Files:** inspect only.

- [ ] **Step 1: Confirm vitest, pdf-parse, recharts, react-dropzone, date-fns versions**

Run: `node -e "const p=require('./package.json').dependencies, d=require('./package.json').devDependencies; console.log({pdfParse:p['pdf-parse'],sdk:p['@anthropic-ai/sdk'],recharts:p['recharts'],dropzone:p['react-dropzone'],dateFns:p['date-fns'],vitest:d['vitest']})"`

Expected: all present (`pdf-parse ^2.x`, `@anthropic-ai/sdk ^0.90.x`, `recharts ^3.x`, `react-dropzone` present, `date-fns ^4.x`, `vitest ^4.x`). If any missing, install before proceeding.

- [ ] **Step 2: Confirm existing fd-statement parser compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -40`
Expected: no errors. Parser pattern at [parse-pdf.ts](src/lib/fd-statement/parse-pdf.ts) is our template.

- [ ] **Step 3: Confirm session helper exists**

Run Grep: pattern `export async function getSessionUserId`, path `src/lib/session.ts`
Expected: 1 match. Use this throughout — **not** hand-rolled `getServerSession`.

- [ ] **Step 4: No commit (inspection only).**

---

## Task 1: Prisma schema — five new models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Append the five models + back-relations**

Append at end of `prisma/schema.prisma`:

```prisma
model BankAccount {
  id                  String   @id @default(cuid())
  userId              String
  label               String
  bankName            String
  accountNumberLast4  String?
  accountType         String   @default("savings") // "savings" | "current" | "credit"
  disabled            Boolean  @default(false)
  transactions        Transaction[]
  imports             StatementImport[]
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([userId])
}

model TransactionCategory {
  id          String   @id @default(cuid())
  userId      String?  // null = system preset visible to all users
  name        String
  kind        String   @default("expense") // "expense" | "income" | "transfer"
  icon        String?
  color       String?
  sortOrder   Int      @default(100)
  disabled    Boolean  @default(false)
  transactions  Transaction[]
  rules         MerchantRule[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}

model Transaction {
  id                      String   @id @default(cuid())
  userId                  String
  accountId               String
  account                 BankAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  txnDate                 DateTime
  valueDate               DateTime?
  description             String
  normalizedDescription   String
  amount                  Float
  direction               String   // "debit" | "credit"
  runningBalance          Float?
  bankRef                 String?
  categoryId              String?
  category                TransactionCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categorySource          String?  // "claude" | "rule" | "user" | "transfer-detect"
  transferGroupId         String?
  notes                   String?
  importId                String
  import                  StatementImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@unique([userId, accountId, bankRef])
  @@unique([userId, accountId, txnDate, amount, normalizedDescription])
  @@index([userId, txnDate])
  @@index([accountId, txnDate])
  @@index([categoryId])
  @@index([transferGroupId])
}

model MerchantRule {
  id                          String   @id @default(cuid())
  userId                      String
  pattern                     String
  categoryId                  String
  category                    TransactionCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  matchCount                  Int      @default(0)
  createdFromTransactionId    String?
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  @@index([userId])
}

model StatementImport {
  id                     String   @id @default(cuid())
  userId                 String
  accountId              String
  account                BankAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  fileUrl                String
  fileName               String
  pageCount              Int?
  statementPeriodStart   DateTime?
  statementPeriodEnd     DateTime?
  status                 String   @default("pending") // pending|extracting|preview|saved|failed|cancelled
  extractedCount         Int      @default(0)
  newCount               Int      @default(0)
  duplicateCount         Int      @default(0)
  claudeInputTokens      Int?
  claudeOutputTokens     Int?
  claudeCostUsd          Float?
  errorMessage           String?
  stagedTransactions     String?  // JSON string of preview rows (SQLite has no native JSON)
  transactions           Transaction[]
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([accountId])
}
```

Note: SQLite composite-unique indexes on nullable columns treat `NULL` as distinct, so `(userId, accountId, bankRef)` will NOT collide when `bankRef` is null — that's exactly what we want (fall back to the second unique index).

- [ ] **Step 2: Generate + push schema**

Run: `npx prisma generate && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(bank-accounts): schema for accounts, categories, transactions, rules, imports"
```

---

## Task 2: Preset categories seed

**Files:**
- Create: `prisma/seeds/preset-categories.ts`

- [ ] **Step 1: Write the seed script**

```ts
// prisma/seeds/preset-categories.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRESETS = [
  { name: "Grocery",         kind: "expense",  icon: "ShoppingCart",  color: "#22c55e", sortOrder: 10 },
  { name: "Food & Dining",   kind: "expense",  icon: "UtensilsCrossed", color: "#f97316", sortOrder: 20 },
  { name: "Petrol",          kind: "expense",  icon: "Fuel",          color: "#eab308", sortOrder: 30 },
  { name: "Medical",         kind: "expense",  icon: "HeartPulse",    color: "#ef4444", sortOrder: 40 },
  { name: "Utilities",       kind: "expense",  icon: "Zap",           color: "#0ea5e9", sortOrder: 50 },
  { name: "Rent",            kind: "expense",  icon: "Home",          color: "#8b5cf6", sortOrder: 60 },
  { name: "Travel",          kind: "expense",  icon: "Plane",         color: "#06b6d4", sortOrder: 70 },
  { name: "Shopping",        kind: "expense",  icon: "ShoppingBag",   color: "#ec4899", sortOrder: 80 },
  { name: "Entertainment",   kind: "expense",  icon: "Film",          color: "#a855f7", sortOrder: 90 },
  { name: "Salary",          kind: "income",   icon: "Banknote",      color: "#10b981", sortOrder: 100 },
  { name: "Interest",        kind: "income",   icon: "TrendingUp",    color: "#14b8a6", sortOrder: 110 },
  { name: "Refund",          kind: "income",   icon: "RotateCcw",     color: "#84cc16", sortOrder: 120 },
  { name: "Transfer",        kind: "transfer", icon: "ArrowLeftRight", color: "#6b7280", sortOrder: 200 },
];

async function main() {
  for (const p of PRESETS) {
    const existing = await prisma.transactionCategory.findFirst({
      where: { userId: null, name: p.name },
    });
    if (existing) {
      await prisma.transactionCategory.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.transactionCategory.create({ data: { ...p, userId: null } });
    }
  }
  console.log(`Seeded ${PRESETS.length} preset categories.`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add npm script + run**

Read `package.json`. Add to `scripts`:
```json
"db:seed:categories": "tsx prisma/seeds/preset-categories.ts"
```

Run: `npm run db:seed:categories`
Expected: `Seeded 13 preset categories.`

- [ ] **Step 3: Commit**

```bash
git add prisma/seeds/preset-categories.ts package.json
git commit -m "feat(bank-accounts): seed preset categories"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/lib/bank-accounts/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/bank-accounts/types.ts
export type Direction = "debit" | "credit";
export type CategoryKind = "expense" | "income" | "transfer";
export type CategorySource = "claude" | "rule" | "user" | "transfer-detect";
export type ImportStatus =
  | "pending" | "extracting" | "preview" | "saved" | "failed" | "cancelled";

export interface ExtractedTxn {
  txnDate: string;          // YYYY-MM-DD (local)
  valueDate: string | null;
  description: string;
  amount: number;
  direction: Direction;
  runningBalance: number | null;
  bankRef: string | null;
  claudeCategory: string | null; // Claude's suggested category name (validated later)
}

export interface StagedTxn extends ExtractedTxn {
  normalizedDescription: string;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  categoryId: string | null;
  categorySource: CategorySource | null;
  skip: boolean;            // user may drop a row in preview
}

export interface CategoryLite {
  id: string;
  name: string;
  kind: CategoryKind;
  userId: string | null;    // null = preset
}

export interface MerchantRuleLite {
  id: string;
  pattern: string;
  categoryId: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-accounts/types.ts
git commit -m "feat(bank-accounts): shared types"
```

---

## Task 4: `normalize-description.ts` (TDD)

**Files:**
- Create: `src/lib/bank-accounts/normalize-description.ts`
- Test: `src/lib/bank-accounts/normalize-description.test.ts`

Purpose: produce a stable key for the fallback dedup index. Strips whitespace, uppercases, drops ref-id-looking tokens (long digit runs ≥ 10), reduces repeated whitespace.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/bank-accounts/normalize-description.test.ts
import { describe, it, expect } from "vitest";
import { normalizeDescription } from "./normalize-description";

describe("normalizeDescription", () => {
  it("uppercases and trims", () => {
    expect(normalizeDescription("  swiggy bangalore  ")).toBe("SWIGGY BANGALORE");
  });
  it("strips long digit ref ids (>=10 digits)", () => {
    expect(normalizeDescription("UPI/SWIGGY/1234567890123/PAYMENT")).toBe("UPI/SWIGGY//PAYMENT");
  });
  it("keeps short numbers (e.g. store numbers)", () => {
    expect(normalizeDescription("DMART 42 KORAMANGALA")).toBe("DMART 42 KORAMANGALA");
  });
  it("collapses repeated whitespace", () => {
    expect(normalizeDescription("HDFC   ATM\t\tWITHDRAWAL")).toBe("HDFC ATM WITHDRAWAL");
  });
  it("returns empty for empty input", () => {
    expect(normalizeDescription("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/bank-accounts/normalize-description`
Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/bank-accounts/normalize-description.ts
export function normalizeDescription(input: string): string {
  if (!input) return "";
  return input
    .replace(/\d{10,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/bank-accounts/normalize-description`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/normalize-description.ts src/lib/bank-accounts/normalize-description.test.ts
git commit -m "feat(bank-accounts): normalizeDescription util"
```

---

## Task 5: `dedup.ts` (TDD)

**Files:**
- Create: `src/lib/bank-accounts/dedup.ts`
- Test: `src/lib/bank-accounts/dedup.test.ts`

Purpose: given staged extracted rows + the user's existing transactions for the same account, mark duplicates. Primary key: `(accountId, bankRef)` when `bankRef` present; fallback: `(accountId, txnDate, amountPaise, normalizedDescription)`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/bank-accounts/dedup.test.ts
import { describe, it, expect } from "vitest";
import { markDuplicates, amountToPaise } from "./dedup";

describe("amountToPaise", () => {
  it("converts rupees to integer paise", () => {
    expect(amountToPaise(123.45)).toBe(12345);
    expect(amountToPaise(0)).toBe(0);
    expect(amountToPaise(1)).toBe(100);
  });
  it("rounds float noise", () => {
    expect(amountToPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("markDuplicates", () => {
  const existing = [
    { id: "e1", bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY" },
    { id: "e2", bankRef: null,     txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART" },
  ];

  it("flags bankRef match", () => {
    const staged = [
      { bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY" },
      { bankRef: "UPI999", txnDate: "2026-04-03", amount: 500, normalizedDescription: "AMAZON" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e1");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("flags fallback key when bankRef is null", () => {
    const staged = [
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART" },
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "AMAZON" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e2");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("does not collide on bankRef when both sides have null", () => {
    const staged = [{ bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "X" }];
    const out = markDuplicates(staged, [{ id: "z", bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "Y" }]);
    expect(out[0].isDuplicate).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/bank-accounts/dedup`

- [ ] **Step 3: Implement**

```ts
// src/lib/bank-accounts/dedup.ts
export function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}

interface StagedKey {
  bankRef: string | null;
  txnDate: string;
  amount: number;
  normalizedDescription: string;
}

interface ExistingRow extends StagedKey {
  id: string;
}

export function markDuplicates<T extends StagedKey>(
  staged: T[],
  existing: ExistingRow[],
): Array<T & { isDuplicate: boolean; duplicateOfId: string | null }> {
  const byRef = new Map<string, string>();
  const byFallback = new Map<string, string>();
  for (const e of existing) {
    if (e.bankRef) byRef.set(e.bankRef, e.id);
    const fk = `${e.txnDate}|${amountToPaise(e.amount)}|${e.normalizedDescription}`;
    byFallback.set(fk, e.id);
  }
  return staged.map((s) => {
    let matchId: string | null = null;
    if (s.bankRef && byRef.has(s.bankRef)) matchId = byRef.get(s.bankRef)!;
    else {
      const fk = `${s.txnDate}|${amountToPaise(s.amount)}|${s.normalizedDescription}`;
      if (byFallback.has(fk)) matchId = byFallback.get(fk)!;
    }
    return { ...s, isDuplicate: matchId !== null, duplicateOfId: matchId };
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/bank-accounts/dedup`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/dedup.ts src/lib/bank-accounts/dedup.test.ts
git commit -m "feat(bank-accounts): dedup detection with bankRef + fallback key"
```

---

## Task 6: `merchant-rules.ts` (TDD)

**Files:**
- Create: `src/lib/bank-accounts/merchant-rules.ts`
- Test: `src/lib/bank-accounts/merchant-rules.test.ts`

Functions:
- `applyRules(normalizedDescription, rules)` — return `categoryId | null`. Longest-pattern-wins, case-insensitive, `*` wildcard.
- `suggestPattern(normalizedDescription)` — produce a candidate rule string by stripping trailing digits, city suffixes, and ref-id-looking tokens.
- `isPatternTooBroad(pattern, allNormalizedDescriptions)` — `true` if pattern < 3 chars OR matches > 50% of descriptions.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/bank-accounts/merchant-rules.test.ts
import { describe, it, expect } from "vitest";
import { applyRules, suggestPattern, isPatternTooBroad } from "./merchant-rules";

describe("applyRules", () => {
  const rules = [
    { id: "r1", pattern: "SWIGGY", categoryId: "food" },
    { id: "r2", pattern: "SWIGGY INSTAMART", categoryId: "grocery" },
    { id: "r3", pattern: "AMAZON*", categoryId: "shopping" },
  ];

  it("returns null when no rule matches", () => {
    expect(applyRules("FLIPKART", rules)).toBeNull();
  });
  it("longer pattern wins over shorter", () => {
    expect(applyRules("SWIGGY INSTAMART BANGALORE", rules)).toBe("grocery");
  });
  it("matches plain substring case-insensitive", () => {
    expect(applyRules("UPI/swiggy/tx1", rules)).toBe("food");
  });
  it("supports * wildcard", () => {
    expect(applyRules("AMAZON PAY INDIA", rules)).toBe("shopping");
  });
});

describe("suggestPattern", () => {
  it("strips trailing digits and ref ids", () => {
    expect(suggestPattern("SWIGGY BANGALORE 123456789012")).toBe("SWIGGY BANGALORE");
  });
  it("keeps core merchant token", () => {
    expect(suggestPattern("UPI/DMART KORAMANGALA/TXN")).toBe("UPI/DMART KORAMANGALA/TXN");
  });
  it("collapses whitespace", () => {
    expect(suggestPattern("DMART   42   ")).toBe("DMART 42");
  });
});

describe("isPatternTooBroad", () => {
  const all = ["SWIGGY BANGALORE", "SWIGGY PUNE", "AMAZON", "DMART"];
  it("rejects patterns shorter than 3 chars", () => {
    expect(isPatternTooBroad("AB", all)).toBe(true);
  });
  it("rejects patterns matching > 50%", () => {
    expect(isPatternTooBroad("S", all)).toBe(true); // would match 0 with 3-char guard; use longer
    expect(isPatternTooBroad("A", all)).toBe(true);
  });
  it("accepts specific patterns", () => {
    expect(isPatternTooBroad("SWIGGY", all)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/bank-accounts/merchant-rules`

- [ ] **Step 3: Implement**

```ts
// src/lib/bank-accounts/merchant-rules.ts
export interface RuleLite {
  id: string;
  pattern: string;
  categoryId: string;
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
}

export function applyRules(description: string, rules: RuleLite[]): string | null {
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const r of sorted) {
    if (patternToRegex(r.pattern).test(description)) return r.categoryId;
  }
  return null;
}

export function suggestPattern(description: string): string {
  return description
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPatternTooBroad(pattern: string, allDescriptions: string[]): boolean {
  if (pattern.length < 3) return true;
  if (allDescriptions.length === 0) return false;
  const re = patternToRegex(pattern);
  const hits = allDescriptions.filter((d) => re.test(d)).length;
  return hits / allDescriptions.length > 0.5;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/bank-accounts/merchant-rules`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/merchant-rules.ts src/lib/bank-accounts/merchant-rules.test.ts
git commit -m "feat(bank-accounts): merchant rules apply/suggest/too-broad"
```

---

## Task 7: `transfer-detect.ts` (TDD)

**Files:**
- Create: `src/lib/bank-accounts/transfer-detect.ts`
- Test: `src/lib/bank-accounts/transfer-detect.test.ts`

Function: `findTransferPairs(txns)` → array of `{ debitId, creditId, groupId }`. Match rule: debit on account A ↔ credit on account B, same amount (integer paise), `|dateDiff| ≤ 1 day`, neither already in a group, neither `categorySource === 'user'`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/bank-accounts/transfer-detect.test.ts
import { describe, it, expect } from "vitest";
import { findTransferPairs } from "./transfer-detect";

type T = {
  id: string; accountId: string; txnDate: string; amount: number;
  direction: "debit" | "credit"; transferGroupId: string | null;
  categorySource: string | null; description: string;
};

describe("findTransferPairs", () => {
  it("matches debit A with credit B same day same amount", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "TO HDFC 1234" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "FROM ICICI" },
    ];
    const pairs = findTransferPairs(txns);
    expect(pairs.length).toBe(1);
    expect(pairs[0].debitId).toBe("d");
    expect(pairs[0].creditId).toBe("c");
  });

  it("matches within ±1 day", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-02", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns).length).toBe(1);
  });

  it("skips when same account", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "X" },
      { id: "c", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("skips when user already set category", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: "user", description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("skips when already grouped", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: "g1", categorySource: null, description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null,  categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("tiebreaks on closest date, then description-mentions-other-account", () => {
    const txns: T[] = [
      { id: "d",  accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "TRF TO HDFC 1234" },
      { id: "c1", accountId: "B", txnDate: "2026-04-02", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "UNKNOWN" },
      { id: "c2", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "UNKNOWN" },
    ];
    const pairs = findTransferPairs(txns);
    expect(pairs.length).toBe(1);
    expect(pairs[0].creditId).toBe("c2");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/bank-accounts/transfer-detect`

- [ ] **Step 3: Implement**

```ts
// src/lib/bank-accounts/transfer-detect.ts
import { amountToPaise } from "./dedup";

interface TxnLite {
  id: string;
  accountId: string;
  txnDate: string;
  amount: number;
  direction: "debit" | "credit";
  transferGroupId: string | null;
  categorySource: string | null;
  description: string;
}

export interface TransferPair {
  debitId: string;
  creditId: string;
  groupId: string;
}

function daysBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Math.abs(ta - tb) / 86400000;
}

function randomGroupId(): string {
  return "tr_" + Math.random().toString(36).slice(2, 10);
}

export function findTransferPairs(txns: TxnLite[]): TransferPair[] {
  const eligible = txns.filter((t) => !t.transferGroupId && t.categorySource !== "user");
  const debits = eligible.filter((t) => t.direction === "debit");
  const credits = eligible.filter((t) => t.direction === "credit");

  const used = new Set<string>();
  const pairs: TransferPair[] = [];

  const sortedDebits = [...debits].sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  for (const d of sortedDebits) {
    if (used.has(d.id)) continue;
    const dPaise = amountToPaise(d.amount);
    const candidates = credits.filter((c) =>
      !used.has(c.id) &&
      c.accountId !== d.accountId &&
      amountToPaise(c.amount) === dPaise &&
      daysBetween(c.txnDate, d.txnDate) <= 1,
    );
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const da = daysBetween(a.txnDate, d.txnDate);
      const db = daysBetween(b.txnDate, d.txnDate);
      if (da !== db) return da - db;
      const aHit = d.description.toUpperCase().includes(a.accountId.toUpperCase()) ? -1 : 0;
      const bHit = d.description.toUpperCase().includes(b.accountId.toUpperCase()) ? -1 : 0;
      return aHit - bHit;
    });

    const match = candidates[0];
    used.add(d.id);
    used.add(match.id);
    pairs.push({ debitId: d.id, creditId: match.id, groupId: randomGroupId() });
  }

  return pairs;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/bank-accounts/transfer-detect`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/transfer-detect.ts src/lib/bank-accounts/transfer-detect.test.ts
git commit -m "feat(bank-accounts): transfer pair detection"
```

---

## Task 8: `aggregations.ts` (TDD)

**Files:**
- Create: `src/lib/bank-accounts/aggregations.ts`
- Test: `src/lib/bank-accounts/aggregations.test.ts`

Pure helpers used by analytics endpoints:
- `totalSpending(txns)` — sum of debits excluding `category.kind === 'transfer'` (uncategorized INCLUDED).
- `totalIncome(txns)` — same for credits.
- `byCategory(txns, direction)` → `Array<{ categoryId: string | null; name: string; total: number; count: number }>`, excludes transfer kind.
- `byMonth(txns)` → `Array<{ month: 'YYYY-MM'; spending: number; income: number }>`.
- `byDay(txns, year, month)` → `Record<'YYYY-MM-DD', number>` (spending only).
- `topMerchants(txns, limit)` → group by `normalizedDescription` among debits (non-transfer), top-N by total.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/bank-accounts/aggregations.test.ts
import { describe, it, expect } from "vitest";
import { totalSpending, totalIncome, byCategory, byMonth, byDay, topMerchants } from "./aggregations";

type T = {
  txnDate: string; amount: number; direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string; kind: "expense" | "income" | "transfer" } | null;
  normalizedDescription: string;
};

const transfer = { id: "t", name: "Transfer", kind: "transfer" as const };
const grocery  = { id: "g", name: "Grocery",  kind: "expense"  as const };

const txns: T[] = [
  { txnDate: "2026-04-01", amount: 500,  direction: "debit",  categoryId: "g", category: grocery,  normalizedDescription: "DMART" },
  { txnDate: "2026-04-03", amount: 300,  direction: "debit",  categoryId: null, category: null,    normalizedDescription: "UNKNOWN SHOP" },
  { txnDate: "2026-04-05", amount: 2000, direction: "debit",  categoryId: "t", category: transfer, normalizedDescription: "TO SAVINGS" },
  { txnDate: "2026-04-07", amount: 50000, direction: "credit", categoryId: null, category: null,   normalizedDescription: "SALARY CREDIT" },
  { txnDate: "2026-03-28", amount: 100,  direction: "debit",  categoryId: "g", category: grocery,  normalizedDescription: "DMART" },
];

describe("aggregations", () => {
  it("totalSpending excludes transfers, includes uncategorized", () => {
    expect(totalSpending(txns)).toBe(500 + 300 + 100);
  });
  it("totalIncome excludes transfers", () => {
    expect(totalIncome(txns)).toBe(50000);
  });
  it("byCategory groups non-transfer debits including uncategorized bucket", () => {
    const rows = byCategory(txns, "debit");
    const grocery = rows.find((r) => r.categoryId === "g");
    const uncat = rows.find((r) => r.categoryId === null);
    expect(grocery?.total).toBe(600);
    expect(uncat?.total).toBe(300);
    expect(rows.find((r) => r.categoryId === "t")).toBeUndefined();
  });
  it("byMonth sums spend and income per month", () => {
    const months = byMonth(txns);
    const apr = months.find((m) => m.month === "2026-04");
    const mar = months.find((m) => m.month === "2026-03");
    expect(apr?.spending).toBe(800);
    expect(apr?.income).toBe(50000);
    expect(mar?.spending).toBe(100);
  });
  it("byDay buckets spending for selected month", () => {
    const days = byDay(txns, 2026, 4);
    expect(days["2026-04-01"]).toBe(500);
    expect(days["2026-04-03"]).toBe(300);
    expect(days["2026-04-05"]).toBeUndefined();
  });
  it("topMerchants ranks by total", () => {
    const top = topMerchants(txns, 3);
    expect(top[0].normalizedDescription).toBe("DMART");
    expect(top[0].total).toBe(600);
    expect(top[0].count).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/bank-accounts/aggregations`

- [ ] **Step 3: Implement**

```ts
// src/lib/bank-accounts/aggregations.ts
export interface TxnForAgg {
  txnDate: string;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string; kind: "expense" | "income" | "transfer" } | null;
  normalizedDescription: string;
}

const isTransfer = (t: TxnForAgg) => t.category?.kind === "transfer";

export function totalSpending(txns: TxnForAgg[]): number {
  return txns.filter((t) => t.direction === "debit" && !isTransfer(t)).reduce((s, t) => s + t.amount, 0);
}

export function totalIncome(txns: TxnForAgg[]): number {
  return txns.filter((t) => t.direction === "credit" && !isTransfer(t)).reduce((s, t) => s + t.amount, 0);
}

export function byCategory(txns: TxnForAgg[], direction: "debit" | "credit") {
  const buckets = new Map<string, { categoryId: string | null; name: string; total: number; count: number }>();
  for (const t of txns) {
    if (t.direction !== direction || isTransfer(t)) continue;
    const key = t.categoryId ?? "__uncat__";
    const name = t.category?.name ?? "Uncategorized";
    const row = buckets.get(key) ?? { categoryId: t.categoryId, name, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    buckets.set(key, row);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export function byMonth(txns: TxnForAgg[]) {
  const map = new Map<string, { month: string; spending: number; income: number }>();
  for (const t of txns) {
    if (isTransfer(t)) continue;
    const month = t.txnDate.slice(0, 7);
    const row = map.get(month) ?? { month, spending: 0, income: 0 };
    if (t.direction === "debit") row.spending += t.amount;
    else row.income += t.amount;
    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function byDay(txns: TxnForAgg[], year: number, month: number): Record<string, number> {
  const mm = String(month).padStart(2, "0");
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (t.direction !== "debit" || isTransfer(t)) continue;
    if (!t.txnDate.startsWith(`${year}-${mm}`)) continue;
    out[t.txnDate] = (out[t.txnDate] ?? 0) + t.amount;
  }
  return out;
}

export function topMerchants(txns: TxnForAgg[], limit: number) {
  const map = new Map<string, { normalizedDescription: string; total: number; count: number }>();
  for (const t of txns) {
    if (t.direction !== "debit" || isTransfer(t)) continue;
    const row = map.get(t.normalizedDescription) ?? { normalizedDescription: t.normalizedDescription, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    map.set(t.normalizedDescription, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/bank-accounts/aggregations`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/aggregations.ts src/lib/bank-accounts/aggregations.test.ts
git commit -m "feat(bank-accounts): analytics aggregation helpers"
```

---

## Task 9: `pdf-text.ts` — text extraction wrapper

**Files:**
- Create: `src/lib/bank-accounts/pdf-text.ts`

Mirrors `src/lib/fd-statement/parse-pdf.ts` pattern — dynamic import of pdf-parse v2.

- [ ] **Step 1: Implement**

```ts
// src/lib/bank-accounts/pdf-text.ts
export interface PdfTextResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(pdfBytes: Buffer): Promise<PdfTextResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
  try {
    const result = await parser.getText();
    return { text: result.text ?? "", pageCount: result.total ?? 0 };
  } finally {
    await parser.destroy();
  }
}

export const TEXT_VISION_FALLBACK_THRESHOLD = 200;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-accounts/pdf-text.ts
git commit -m "feat(bank-accounts): pdf text extraction wrapper"
```

---

## Task 10: Claude extraction prompt + `extract-transactions.ts`

**Files:**
- Create: `src/lib/bank-accounts/extract-transactions-prompt.ts`
- Create: `src/lib/bank-accounts/extract-transactions.ts`
- Create: `src/lib/bank-accounts/cost-tracking.ts`

- [ ] **Step 1: Write the prompt module**

```ts
// src/lib/bank-accounts/extract-transactions-prompt.ts
export interface PromptInputs {
  categoryNames: string[];
  extractedText: string | null; // null when we go straight to vision
}

export function buildSystemPrompt(inputs: PromptInputs): string {
  return `You are a bank-statement transaction extractor for a personal finance app.

Return ONLY a JSON object (no prose, no code fences). Schema:
{
  "statementPeriodStart": "YYYY-MM-DD" | null,
  "statementPeriodEnd":   "YYYY-MM-DD" | null,
  "transactions": [
    {
      "txnDate":        "YYYY-MM-DD",
      "valueDate":      "YYYY-MM-DD" | null,
      "description":    string,
      "amount":         number,
      "direction":      "debit" | "credit",
      "runningBalance": number | null,
      "bankRef":        string | null,
      "suggestedCategory": string | null
    }
  ]
}

Rules:
- Include EVERY transaction row, even small ones. Skip opening/closing balance lines and page totals.
- txnDate must be the transaction date, not the print/run date.
- amount is always POSITIVE. Use "direction" to distinguish debit vs credit.
- bankRef: UPI reference id, cheque number, or bank's internal txn id when present; else null.
- suggestedCategory MUST be exactly one of: ${inputs.categoryNames.join(", ")}, or null if none fits. No synonyms.
- Do not invent values. If unclear, return null for the field.
- Output the JSON object and nothing else.`;
}

export function buildUserText(): string {
  return "Extract all transactions from this statement.";
}
```

- [ ] **Step 2: Write cost-tracking**

```ts
// src/lib/bank-accounts/cost-tracking.ts
// Claude Haiku 4.5 pricing (USD per 1M tokens): input $1.00, output $5.00.
// Source: anthropic.com/pricing as of 2026-04. Update here if pricing changes.
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_PER_MTOK;
}
```

- [ ] **Step 3: Write extract-transactions orchestrator**

Reuses the document-block pattern from [ai-parser.ts](src/lib/fd-statement/ai-parser.ts:1).

```ts
// src/lib/bank-accounts/extract-transactions.ts
import { anthropic } from "@/lib/anthropic";
import type { ExtractedTxn } from "./types";
import { buildSystemPrompt, buildUserText } from "./extract-transactions-prompt";
import { estimateCostUsd } from "./cost-tracking";

type DocumentBlockParam = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

export interface ExtractionResult {
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  transactions: ExtractedTxn[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface RawTxn {
  txnDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  runningBalance: number | null;
  bankRef: string | null;
  suggestedCategory: string | null;
}

interface RawResponse {
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  transactions: RawTxn[];
}

function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

export async function extractTransactions(
  pdfBytes: Buffer,
  categoryNames: string[],
): Promise<ExtractionResult> {
  const systemPrompt = buildSystemPrompt({ categoryNames, extractedText: null });
  const pdfBlock: DocumentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdfBytes.toString("base64") },
  };

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as never,
    ] as never,
    messages: [
      { role: "user", content: [pdfBlock as never, { type: "text", text: buildUserText() }] },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { statementPeriodStart: null, statementPeriodEnd: null, transactions: [], inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costUsd: estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens) };
  }

  let parsed: RawResponse;
  try {
    parsed = JSON.parse(stripFences(textBlock.text));
  } catch {
    throw new Error("Claude returned malformed JSON");
  }

  const allowed = new Set(categoryNames);
  const transactions: ExtractedTxn[] = (parsed.transactions ?? []).map((r) => ({
    txnDate: r.txnDate,
    valueDate: r.valueDate,
    description: r.description,
    amount: Number(r.amount) || 0,
    direction: r.direction,
    runningBalance: r.runningBalance ?? null,
    bankRef: r.bankRef ?? null,
    claudeCategory: r.suggestedCategory && allowed.has(r.suggestedCategory) ? r.suggestedCategory : null,
  }));

  return {
    statementPeriodStart: parsed.statementPeriodStart ?? null,
    statementPeriodEnd: parsed.statementPeriodEnd ?? null,
    transactions,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: estimateCostUsd(res.usage.input_tokens, res.usage.output_tokens),
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bank-accounts/extract-transactions-prompt.ts src/lib/bank-accounts/extract-transactions.ts src/lib/bank-accounts/cost-tracking.ts
git commit -m "feat(bank-accounts): Claude extraction with prompt caching + cost tracking"
```

---

## Task 11: `categorize.ts` — orchestrator

**Files:**
- Create: `src/lib/bank-accounts/categorize.ts`

- [ ] **Step 1: Implement**

```ts
// src/lib/bank-accounts/categorize.ts
import type { CategoryLite, CategorySource, ExtractedTxn, StagedTxn } from "./types";
import { applyRules, type RuleLite } from "./merchant-rules";
import { normalizeDescription } from "./normalize-description";

export function categorizeRows(
  rows: ExtractedTxn[],
  rules: RuleLite[],
  categoriesByName: Map<string, CategoryLite>,
): Array<StagedTxn> {
  return rows.map((r) => {
    const normalized = normalizeDescription(r.description);
    const ruleMatch = applyRules(normalized, rules);
    let categoryId: string | null = null;
    let categorySource: CategorySource | null = null;
    if (ruleMatch) {
      categoryId = ruleMatch;
      categorySource = "rule";
    } else if (r.claudeCategory) {
      const cat = categoriesByName.get(r.claudeCategory);
      if (cat) {
        categoryId = cat.id;
        categorySource = "claude";
      }
    }
    return {
      ...r,
      normalizedDescription: normalized,
      isDuplicate: false,
      duplicateOfId: null,
      categoryId,
      categorySource,
      skip: false,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-accounts/categorize.ts
git commit -m "feat(bank-accounts): rule→Claude categorization orchestrator"
```

---

## Task 12: API — Accounts CRUD

**Files:**
- Create: `src/app/api/bank-accounts/accounts/route.ts`
- Create: `src/app/api/bank-accounts/accounts/[id]/route.ts`

- [ ] **Step 1: GET + POST**

```ts
// src/app/api/bank-accounts/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.bankAccount.findMany({
    where: { userId, disabled: false },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { label, bankName, accountNumberLast4, accountType } = body as {
    label: string; bankName: string; accountNumberLast4?: string; accountType?: string;
  };
  if (!label?.trim() || !bankName?.trim()) {
    return NextResponse.json({ error: "label and bankName required" }, { status: 400 });
  }
  const created = await prisma.bankAccount.create({
    data: {
      userId,
      label: label.trim(),
      bankName: bankName.trim(),
      accountNumberLast4: accountNumberLast4?.trim() || null,
      accountType: accountType ?? "savings",
    },
  });
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: GET/PATCH/DELETE by id**

```ts
// src/app/api/bank-accounts/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.bankAccount.update({
    where: { id },
    data: {
      label: body.label ?? undefined,
      bankName: body.bankName ?? undefined,
      accountNumberLast4: body.accountNumberLast4 ?? undefined,
      accountType: body.accountType ?? undefined,
      disabled: body.disabled ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const txnCount = await prisma.transaction.count({ where: { accountId: id } });
  if (txnCount > 0) {
    return NextResponse.json(
      { error: "Account has transactions. Disable it instead of deleting." },
      { status: 409 },
    );
  }
  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bank-accounts/accounts
git commit -m "feat(bank-accounts): accounts CRUD API"
```

---

## Task 13: API — Categories CRUD

**Files:**
- Create: `src/app/api/bank-accounts/categories/route.ts`
- Create: `src/app/api/bank-accounts/categories/[id]/route.ts`

- [ ] **Step 1: GET + POST**

```ts
// src/app/api/bank-accounts/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.transactionCategory.findMany({
    where: { OR: [{ userId: null }, { userId }], disabled: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { name, kind, icon, color, sortOrder } = body as {
    name: string; kind: "expense" | "income" | "transfer"; icon?: string; color?: string; sortOrder?: number;
  };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const created = await prisma.transactionCategory.create({
    data: {
      userId,
      name: name.trim(),
      kind: kind ?? "expense",
      icon: icon ?? null,
      color: color ?? null,
      sortOrder: sortOrder ?? 500,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: PATCH + soft DELETE**

```ts
// src/app/api/bank-accounts/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.transactionCategory.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.transactionCategory.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      kind: body.kind ?? undefined,
      icon: body.icon ?? undefined,
      color: body.color ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.transactionCategory.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
  await prisma.transactionCategory.update({ where: { id }, data: { disabled: true } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bank-accounts/categories
git commit -m "feat(bank-accounts): categories CRUD API"
```

---

## Task 14: API — Rules CRUD

**Files:**
- Create: `src/app/api/bank-accounts/rules/route.ts`
- Create: `src/app/api/bank-accounts/rules/[id]/route.ts`

- [ ] **Step 1: GET + POST (with too-broad guard)**

```ts
// src/app/api/bank-accounts/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { isPatternTooBroad } from "@/lib/bank-accounts/merchant-rules";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.merchantRule.findMany({
    where: { userId },
    orderBy: { matchCount: "desc" },
    include: { category: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { pattern, categoryId, createdFromTransactionId } = body as {
    pattern: string; categoryId: string; createdFromTransactionId?: string;
  };
  if (!pattern?.trim() || !categoryId) {
    return NextResponse.json({ error: "pattern and categoryId required" }, { status: 400 });
  }
  const all = await prisma.transaction.findMany({
    where: { userId },
    select: { normalizedDescription: true },
  });
  if (isPatternTooBroad(pattern.trim().toUpperCase(), all.map((a) => a.normalizedDescription))) {
    return NextResponse.json(
      { error: "Pattern is too broad (matches > 50% of your transactions or is too short)" },
      { status: 400 },
    );
  }
  const created = await prisma.merchantRule.create({
    data: {
      userId,
      pattern: pattern.trim().toUpperCase(),
      categoryId,
      createdFromTransactionId: createdFromTransactionId ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: DELETE**

```ts
// src/app/api/bank-accounts/rules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.merchantRule.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.merchantRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bank-accounts/rules
git commit -m "feat(bank-accounts): merchant rules CRUD API"
```

---

## Task 15: API — Import upload (create StatementImport + store PDF)

**Files:**
- Create: `src/app/api/bank-accounts/import/upload/route.ts`

Mirrors the file-save pattern of `src/app/api/fd/upload/route.ts` (random hex filename, `public/uploads/bank-statements` fallback dir).

- [ ] **Step 1: Implement**

```ts
// src/app/api/bank-accounts/import/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const accountId = (form.get("accountId") as string | null)?.trim();
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF exceeds 5 MB" }, { status: 400 });

  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const uploadDir = process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements")
    : path.join(process.cwd(), "public", "uploads", "bank-statements");
  await mkdir(uploadDir, { recursive: true });
  const name = `${randomBytes(10).toString("hex")}.pdf`;
  await writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));
  const fileUrl = `/api/bank-accounts/import/file/${name}`;

  const imp = await prisma.statementImport.create({
    data: {
      userId,
      accountId,
      fileUrl,
      fileName: file.name,
      status: "pending",
    },
  });
  return NextResponse.json({ importId: imp.id, fileUrl, fileName: file.name }, { status: 201 });
}
```

- [ ] **Step 2: Add the file-serving route (mirror of `/api/fd/file/[name]`)**

Run Grep pattern `/api/fd/file` to find the existing reader and copy its shape to `src/app/api/bank-accounts/import/file/[name]/route.ts` (serving from `public/uploads/bank-statements` or `UPLOAD_DIR/bank-statements`).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bank-accounts/import
git commit -m "feat(bank-accounts): statement PDF upload endpoint"
```

---

## Task 16: API — Import extract (Claude call + stage rows)

**Files:**
- Create: `src/app/api/bank-accounts/import/[id]/extract/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/bank-accounts/import/[id]/extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { extractTransactions } from "@/lib/bank-accounts/extract-transactions";
import { categorizeRows } from "@/lib/bank-accounts/categorize";
import { markDuplicates } from "@/lib/bank-accounts/dedup";
import { normalizeDescription } from "@/lib/bank-accounts/normalize-description";
import type { StagedTxn, CategoryLite } from "@/lib/bank-accounts/types";

function resolveLocalPath(fileUrl: string): string {
  const name = fileUrl.replace("/api/bank-accounts/import/file/", "");
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements", name)
    : path.join(process.cwd(), "public", "uploads", "bank-statements", name);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.statementImport.update({ where: { id }, data: { status: "extracting", errorMessage: null } });

  try {
    const bytes = await readFile(resolveLocalPath(imp.fileUrl));

    const categories = await prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
    });
    const categoryNames = categories.map((c) => c.name);
    const categoriesByName = new Map<string, CategoryLite>(
      categories.map((c) => [c.name, { id: c.id, name: c.name, kind: c.kind as CategoryLite["kind"], userId: c.userId }]),
    );

    const extraction = await extractTransactions(Buffer.from(bytes), categoryNames);

    const rules = await prisma.merchantRule.findMany({
      where: { userId },
      select: { id: true, pattern: true, categoryId: true },
    });

    let staged: StagedTxn[] = categorizeRows(extraction.transactions, rules, categoriesByName);

    const existing = await prisma.transaction.findMany({
      where: { userId, accountId: imp.accountId },
      select: { id: true, bankRef: true, txnDate: true, amount: true, normalizedDescription: true },
    });
    const existingForDedup = existing.map((e) => ({
      id: e.id,
      bankRef: e.bankRef,
      txnDate: e.txnDate.toISOString().slice(0, 10),
      amount: e.amount,
      normalizedDescription: e.normalizedDescription,
    }));
    const withDupes = markDuplicates(
      staged.map((s) => ({
        ...s,
        bankRef: s.bankRef,
        txnDate: s.txnDate,
        amount: s.amount,
        normalizedDescription: s.normalizedDescription,
      })),
      existingForDedup,
    );
    staged = staged.map((s, i) => ({
      ...s,
      normalizedDescription: normalizeDescription(s.description),
      isDuplicate: withDupes[i].isDuplicate,
      duplicateOfId: withDupes[i].duplicateOfId,
      skip: withDupes[i].isDuplicate,
    }));

    const dupCount = staged.filter((s) => s.isDuplicate).length;
    const newCount = staged.length - dupCount;

    const updated = await prisma.statementImport.update({
      where: { id },
      data: {
        status: "preview",
        statementPeriodStart: extraction.statementPeriodStart ? new Date(extraction.statementPeriodStart) : null,
        statementPeriodEnd: extraction.statementPeriodEnd ? new Date(extraction.statementPeriodEnd) : null,
        extractedCount: staged.length,
        newCount,
        duplicateCount: dupCount,
        claudeInputTokens: extraction.inputTokens,
        claudeOutputTokens: extraction.outputTokens,
        claudeCostUsd: extraction.costUsd,
        stagedTransactions: JSON.stringify(staged),
      },
    });
    return NextResponse.json({ importId: updated.id, staged, newCount, duplicateCount: dupCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.statementImport.update({
      where: { id },
      data: { status: "failed", errorMessage: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bank-accounts/import
git commit -m "feat(bank-accounts): extract endpoint — Claude + categorize + dedup"
```

---

## Task 17: API — Import commit (insert + transfer detect)

**Files:**
- Create: `src/app/api/bank-accounts/import/[id]/commit/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/bank-accounts/import/[id]/commit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { findTransferPairs } from "@/lib/bank-accounts/transfer-detect";
import type { StagedTxn } from "@/lib/bank-accounts/types";

interface CommitBody {
  txns: StagedTxn[]; // frontend sends possibly-edited preview rows
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as CommitBody;
  const kept = body.txns.filter((t) => !t.skip && !t.isDuplicate);

  const transferCat = await prisma.transactionCategory.findFirst({
    where: { userId: null, kind: "transfer" },
  });

  const result = await prisma.$transaction(async (tx) => {
    let inserted = 0;
    for (const t of kept) {
      try {
        await tx.transaction.create({
          data: {
            userId,
            accountId: imp.accountId,
            txnDate: new Date(t.txnDate),
            valueDate: t.valueDate ? new Date(t.valueDate) : null,
            description: t.description,
            normalizedDescription: t.normalizedDescription,
            amount: t.amount,
            direction: t.direction,
            runningBalance: t.runningBalance,
            bankRef: t.bankRef,
            categoryId: t.categoryId,
            categorySource: t.categorySource,
            importId: imp.id,
          },
        });
        inserted++;
      } catch {
        // unique-index collision — dedup race; skip silently
      }
    }
    await tx.statementImport.update({
      where: { id: imp.id },
      data: { status: "saved", newCount: inserted },
    });
    return { inserted };
  });

  // Transfer detection across ALL saved user transactions
  const all = await prisma.transaction.findMany({
    where: { userId },
    select: {
      id: true, accountId: true, txnDate: true, amount: true, direction: true,
      transferGroupId: true, categorySource: true, description: true,
    },
  });
  const lite = all.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    txnDate: t.txnDate.toISOString().slice(0, 10),
    amount: t.amount,
    direction: t.direction as "debit" | "credit",
    transferGroupId: t.transferGroupId,
    categorySource: t.categorySource,
    description: t.description,
  }));
  const pairs = findTransferPairs(lite);
  for (const p of pairs) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: p.debitId },
        data: {
          transferGroupId: p.groupId,
          categoryId: transferCat?.id ?? null,
          categorySource: "transfer-detect",
        },
      }),
      prisma.transaction.update({
        where: { id: p.creditId },
        data: {
          transferGroupId: p.groupId,
          categoryId: transferCat?.id ?? null,
          categorySource: "transfer-detect",
        },
      }),
    ]);
  }

  return NextResponse.json({ inserted: result.inserted, transfersDetected: pairs.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bank-accounts/import
git commit -m "feat(bank-accounts): commit endpoint — insert + transfer detection"
```

---

## Task 18: API — Import status / cancel / list

**Files:**
- Create: `src/app/api/bank-accounts/import/[id]/route.ts`

- [ ] **Step 1: GET (status + staged rows) + DELETE (cancel)**

```ts
// src/app/api/bank-accounts/import/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({
    where: { id, userId },
    include: { account: true },
  });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...imp,
    stagedTransactions: imp.stagedTransactions ? JSON.parse(imp.stagedTransactions) : [],
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.statementImport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/bank-accounts/import/[id]/route.ts"
git commit -m "feat(bank-accounts): import status + cancel endpoint"
```

---

## Task 19: API — Transactions list + update + bulk categorize

**Files:**
- Create: `src/app/api/bank-accounts/transactions/route.ts`
- Create: `src/app/api/bank-accounts/transactions/[id]/route.ts`
- Create: `src/app/api/bank-accounts/transactions/categorize/route.ts`

- [ ] **Step 1: GET list with filters**

```ts
// src/app/api/bank-accounts/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId");
  const categoryIds = url.searchParams.getAll("categoryId");
  const direction = url.searchParams.get("direction");
  const q = url.searchParams.get("q");
  const minAmount = url.searchParams.get("minAmount");
  const maxAmount = url.searchParams.get("maxAmount");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "50"), 200);

  const where: Record<string, unknown> = { userId };
  if (from || to) {
    (where.txnDate as Record<string, Date>) = {};
    if (from) (where.txnDate as Record<string, Date>).gte = new Date(from);
    if (to) (where.txnDate as Record<string, Date>).lte = new Date(to);
  }
  if (accountId) where.accountId = accountId;
  if (categoryIds.length > 0) where.categoryId = { in: categoryIds };
  if (direction) where.direction = direction;
  if (q) where.description = { contains: q };
  if (minAmount || maxAmount) {
    (where.amount as Record<string, number>) = {};
    if (minAmount) (where.amount as Record<string, number>).gte = Number(minAmount);
    if (maxAmount) (where.amount as Record<string, number>).lte = Number(maxAmount);
  }

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, account: true },
    }),
    prisma.transaction.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pageSize });
}
```

- [ ] **Step 2: PATCH single (notes / category)**

```ts
// src/app/api/bank-accounts/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      categoryId: body.categoryId ?? undefined,
      categorySource: body.categoryId !== undefined ? "user" : undefined,
      notes: body.notes ?? undefined,
    },
  });
  return NextResponse.json(updated);
}
```

- [ ] **Step 3: POST bulk categorize + optional rule creation**

```ts
// src/app/api/bank-accounts/transactions/categorize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { isPatternTooBroad } from "@/lib/bank-accounts/merchant-rules";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as {
    transactionIds: string[];
    categoryId: string;
    createRule?: { pattern: string };
    recategorizePast?: boolean;
  };
  if (!body.transactionIds?.length || !body.categoryId) {
    return NextResponse.json({ error: "transactionIds and categoryId required" }, { status: 400 });
  }

  await prisma.transaction.updateMany({
    where: { id: { in: body.transactionIds }, userId },
    data: { categoryId: body.categoryId, categorySource: "user" },
  });

  let ruleCreated: string | null = null;
  let reappliedCount = 0;

  if (body.createRule?.pattern) {
    const all = await prisma.transaction.findMany({
      where: { userId }, select: { normalizedDescription: true },
    });
    const pattern = body.createRule.pattern.trim().toUpperCase();
    if (isPatternTooBroad(pattern, all.map((a) => a.normalizedDescription))) {
      return NextResponse.json({ error: "Pattern is too broad" }, { status: 400 });
    }
    const rule = await prisma.merchantRule.create({
      data: {
        userId,
        pattern,
        categoryId: body.categoryId,
        createdFromTransactionId: body.transactionIds[0],
      },
    });
    ruleCreated = rule.id;

    if (body.recategorizePast) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "%");
      const res = await prisma.transaction.updateMany({
        where: {
          userId,
          normalizedDescription: { contains: pattern.replace(/\*/g, "") },
          categorySource: { not: "user" },
        },
        data: { categoryId: body.categoryId, categorySource: "rule" },
      });
      reappliedCount = res.count;
      void escaped; // pattern-to-LIKE escape reserved for if we switch to raw SQL
    }
  }

  return NextResponse.json({ ruleCreated, reappliedCount });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bank-accounts/transactions
git commit -m "feat(bank-accounts): transactions list + patch + bulk categorize APIs"
```

---

## Task 20: API — Analytics endpoints

**Files:**
- Create: `src/app/api/bank-accounts/analytics/summary/route.ts`
- Create: `src/app/api/bank-accounts/analytics/categories/route.ts`
- Create: `src/app/api/bank-accounts/analytics/merchants/route.ts`

Each accepts `?year=YYYY&month=MM&accountId=...` (accountId optional).

- [ ] **Step 1: Summary (stat cards + month trend + daily heatmap + income-vs-expense)**

```ts
// src/app/api/bank-accounts/analytics/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import {
  byDay, byMonth, totalIncome, totalSpending, type TxnForAgg,
} from "@/lib/bank-accounts/aggregations";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const accountId = url.searchParams.get("accountId");

  const where: Record<string, unknown> = { userId };
  if (accountId) where.accountId = accountId;

  const rows = await prisma.transaction.findMany({
    where,
    include: { category: true },
  });
  const asAgg: TxnForAgg[] = rows.map((r) => ({
    txnDate: r.txnDate.toISOString().slice(0, 10),
    amount: r.amount,
    direction: r.direction as "debit" | "credit",
    categoryId: r.categoryId,
    category: r.category
      ? { id: r.category.id, name: r.category.name, kind: r.category.kind as "expense" | "income" | "transfer" }
      : null,
    normalizedDescription: r.normalizedDescription,
  }));

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthRows = asAgg.filter((r) => r.txnDate.startsWith(monthKey));

  return NextResponse.json({
    stats: {
      spending: totalSpending(monthRows),
      income: totalIncome(monthRows),
      net: totalIncome(monthRows) - totalSpending(monthRows),
      count: monthRows.length,
    },
    monthTrend: byMonth(asAgg).slice(-12),
    heatmap: byDay(asAgg, year, month),
    incomeExpense: byMonth(asAgg).slice(-6),
  });
}
```

- [ ] **Step 2: Category breakdown**

```ts
// src/app/api/bank-accounts/analytics/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { byCategory, type TxnForAgg } from "@/lib/bank-accounts/aggregations";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const accountId = url.searchParams.get("accountId");
  const direction = (url.searchParams.get("direction") ?? "debit") as "debit" | "credit";

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const where: Record<string, unknown> = {
    userId,
    txnDate: { gte: start, lt: end },
  };
  if (accountId) where.accountId = accountId;

  const rows = await prisma.transaction.findMany({ where, include: { category: true } });
  const asAgg: TxnForAgg[] = rows.map((r) => ({
    txnDate: r.txnDate.toISOString().slice(0, 10),
    amount: r.amount,
    direction: r.direction as "debit" | "credit",
    categoryId: r.categoryId,
    category: r.category ? { id: r.category.id, name: r.category.name, kind: r.category.kind as "expense" | "income" | "transfer" } : null,
    normalizedDescription: r.normalizedDescription,
  }));
  return NextResponse.json({ categories: byCategory(asAgg, direction) });
}
```

- [ ] **Step 3: Top merchants**

```ts
// src/app/api/bank-accounts/analytics/merchants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { topMerchants, type TxnForAgg } from "@/lib/bank-accounts/aggregations";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const accountId = url.searchParams.get("accountId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10"), 50);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const where: Record<string, unknown> = { userId, txnDate: { gte: start, lt: end } };
  if (accountId) where.accountId = accountId;

  const rows = await prisma.transaction.findMany({ where, include: { category: true } });
  const asAgg: TxnForAgg[] = rows.map((r) => ({
    txnDate: r.txnDate.toISOString().slice(0, 10),
    amount: r.amount,
    direction: r.direction as "debit" | "credit",
    categoryId: r.categoryId,
    category: r.category ? { id: r.category.id, name: r.category.name, kind: r.category.kind as "expense" | "income" | "transfer" } : null,
    normalizedDescription: r.normalizedDescription,
  }));
  return NextResponse.json({ merchants: topMerchants(asAgg, limit) });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bank-accounts/analytics
git commit -m "feat(bank-accounts): analytics API endpoints"
```

---

## Task 21: Sidebar nav entry

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Add "Bank Accounts" item**

Open [sidebar.tsx](src/components/sidebar.tsx:18) and add `Wallet` to the lucide imports, then insert the nav entry before Settings:

```tsx
// in imports
import { Wallet, ... } from "lucide-react";

// in navItems array (after Gold, before Settings)
{ href: "/dashboard/bank-accounts", label: "Bank Accounts", icon: Wallet },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(bank-accounts): sidebar nav entry"
```

---

## Task 22: UI — Accounts page

**Files:**
- Create: `src/app/dashboard/bank-accounts/accounts/page.tsx`
- Create: `src/app/dashboard/bank-accounts/accounts/accounts-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/dashboard/bank-accounts/accounts/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: { label: "asc" },
  });
  const counts = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { userId },
    _count: { _all: true },
    _max: { txnDate: true },
  });
  const byId = new Map(counts.map((c) => [c.accountId, c]));
  const enriched = accounts.map((a) => ({
    ...a,
    txnCount: byId.get(a.id)?._count._all ?? 0,
    lastTxnDate: byId.get(a.id)?._max.txnDate?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Accounts</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Manage accounts linked to imported statements.</p>
      </div>
      <AccountsClient accounts={enriched} />
    </div>
  );
}
```

- [ ] **Step 2: Client (list + add + edit + disable)**

```tsx
// src/app/dashboard/bank-accounts/accounts/accounts-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  label: string;
  bankName: string;
  accountNumberLast4: string | null;
  accountType: string;
  disabled: boolean;
  txnCount: number;
  lastTxnDate: string | null;
}

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ label: "", bankName: "", accountNumberLast4: "", accountType: "savings" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/bank-accounts/accounts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ label: "", bankName: "", accountNumberLast4: "", accountType: "savings" });
    router.refresh();
  }

  async function toggleDisabled(a: Account) {
    await fetch(`/api/bank-accounts/accounts/${a.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled: !a.disabled }),
    });
    router.refresh();
  }

  async function remove(a: Account) {
    if (a.txnCount > 0) { alert("Disable instead — account has transactions."); return; }
    if (!confirm(`Delete ${a.label}?`)) return;
    await fetch(`/api/bank-accounts/accounts/${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="ab-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="ab-input" placeholder="Label (e.g. HDFC Savings)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="ab-input" placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          <input className="ab-input" placeholder="Last 4 digits" value={form.accountNumberLast4} onChange={(e) => setForm({ ...form, accountNumberLast4: e.target.value })} />
          <select className="ab-input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <button disabled={busy} className="ab-btn ab-btn-accent">{busy ? "Adding…" : "Add Account"}</button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      <table className="w-full text-sm ab-card">
        <thead><tr className="text-left text-[#a0a0a5]">
          <th className="p-3">Label</th>
          <th className="p-3">Bank</th>
          <th className="p-3">Type</th>
          <th className="p-3 text-right">Txns</th>
          <th className="p-3">Last Txn</th>
          <th className="p-3">Status</th>
          <th className="p-3">Actions</th>
        </tr></thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-[#2a2a2e]">
              <td className="p-3">{a.label}{a.accountNumberLast4 ? <span className="text-[#a0a0a5]"> ····{a.accountNumberLast4}</span> : null}</td>
              <td className="p-3">{a.bankName}</td>
              <td className="p-3 capitalize">{a.accountType}</td>
              <td className="p-3 text-right">{a.txnCount}</td>
              <td className="p-3">{a.lastTxnDate ? a.lastTxnDate.slice(0, 10) : "—"}</td>
              <td className="p-3">{a.disabled ? "Disabled" : "Active"}</td>
              <td className="p-3 space-x-3">
                <button onClick={() => toggleDisabled(a)} className="underline">{a.disabled ? "Enable" : "Disable"}</button>
                <button onClick={() => remove(a)} className="text-red-500 underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/accounts
git commit -m "feat(bank-accounts): accounts management page"
```

---

## Task 23: UI — Categories + rules page

**Files:**
- Create: `src/app/dashboard/bank-accounts/categories/page.tsx`
- Create: `src/app/dashboard/bank-accounts/categories/categories-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/dashboard/bank-accounts/categories/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [categories, rules] = await Promise.all([
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.merchantRule.findMany({
      where: { userId },
      orderBy: { matchCount: "desc" },
      include: { category: true },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Categories & Rules</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Preset + custom categories and your learned merchant rules.</p>
      </div>
      <CategoriesClient categories={categories.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))} rules={rules.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), category: { ...r.category, createdAt: r.category.createdAt.toISOString(), updatedAt: r.category.updatedAt.toISOString() } }))} />
    </div>
  );
}
```

- [ ] **Step 2: Client (two sections: categories add/delete, rules list + delete)**

```tsx
// src/app/dashboard/bank-accounts/categories/categories-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat {
  id: string; userId: string | null; name: string; kind: string;
  icon: string | null; color: string | null; sortOrder: number;
}
interface Rule {
  id: string; pattern: string; matchCount: number;
  category: Cat;
}

export function CategoriesClient({ categories, rules }: { categories: Cat[]; rules: Rule[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", kind: "expense" as "expense" | "income" | "transfer" });
  const [error, setError] = useState<string | null>(null);

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/bank-accounts/categories", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ name: "", kind: "expense" });
    router.refresh();
  }
  async function delCat(id: string) {
    if (!confirm("Soft-delete this category? Past transactions keep their label.")) return;
    await fetch(`/api/bank-accounts/categories/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function delRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/bank-accounts/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const userCats = categories.filter((c) => c.userId !== null);
  const presetCats = categories.filter((c) => c.userId === null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <form onSubmit={addCat} className="ab-card p-3 flex gap-2">
          <input className="ab-input flex-1" placeholder="New category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="ab-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "expense" | "income" | "transfer" })}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
          <button className="ab-btn ab-btn-accent">Add</button>
        </form>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="ab-card p-3">
          <h3 className="font-medium mb-2">Presets</h3>
          <ul className="text-sm space-y-1">
            {presetCats.map((c) => <li key={c.id}><span className="text-[#a0a0a5]">{c.kind}:</span> {c.name}</li>)}
          </ul>
        </div>
        <div className="ab-card p-3">
          <h3 className="font-medium mb-2">Your categories</h3>
          {userCats.length === 0
            ? <p className="text-sm text-[#a0a0a5]">No custom categories yet.</p>
            : <ul className="text-sm space-y-1">
                {userCats.map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span><span className="text-[#a0a0a5]">{c.kind}:</span> {c.name}</span>
                    <button onClick={() => delCat(c.id)} className="text-red-500 underline">Delete</button>
                  </li>
                ))}
              </ul>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Merchant rules</h2>
        {rules.length === 0
          ? <p className="text-sm text-[#a0a0a5]">No rules yet. They appear automatically when you correct a transaction's category.</p>
          : <table className="w-full text-sm ab-card">
              <thead><tr className="text-left text-[#a0a0a5]">
                <th className="p-3">Pattern</th><th className="p-3">Category</th><th className="p-3 text-right">Matches</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-[#2a2a2e]">
                    <td className="p-3 font-mono">{r.pattern}</td>
                    <td className="p-3">{r.category.name}</td>
                    <td className="p-3 text-right">{r.matchCount}</td>
                    <td className="p-3 text-right"><button onClick={() => delRule(r.id)} className="text-red-500 underline">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/categories
git commit -m "feat(bank-accounts): categories + rules management page"
```

---

## Task 24: UI — Import wizard (upload + extract + preview + commit)

**Files:**
- Create: `src/app/dashboard/bank-accounts/import/page.tsx`
- Create: `src/app/dashboard/bank-accounts/import/import-wizard.tsx`

- [ ] **Step 1: Server page loads account list**

```tsx
// src/app/dashboard/bank-accounts/import/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId, disabled: false }, orderBy: { label: "asc" } }),
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Import Statement</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Upload a PDF, review extracted rows, commit.</p>
      </div>
      <ImportWizard accounts={accounts} categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} />
    </div>
  );
}
```

- [ ] **Step 2: Client wizard**

```tsx
// src/app/dashboard/bank-accounts/import/import-wizard.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account { id: string; label: string; bankName: string; }
interface CategoryLite { id: string; name: string; kind: string; }

type StagedRow = {
  txnDate: string;
  valueDate: string | null;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  runningBalance: number | null;
  bankRef: string | null;
  normalizedDescription: string;
  categoryId: string | null;
  categorySource: string | null;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  skip: boolean;
};

export function ImportWizard({ accounts, categories }: { accounts: Account[]; categories: CategoryLite[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ new: number; dup: number } | null>(null);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);
    const up = await fetch("/api/bank-accounts/import/upload", { method: "POST", body: fd });
    if (!up.ok) { setError((await up.json()).error); setBusy(false); return; }
    const { importId } = (await up.json()) as { importId: string };
    setImportId(importId);

    const ex = await fetch(`/api/bank-accounts/import/${importId}/extract`, { method: "POST" });
    setBusy(false);
    if (!ex.ok) { setError((await ex.json()).error); return; }
    const data = (await ex.json()) as { staged: StagedRow[]; newCount: number; duplicateCount: number };
    setRows(data.staged);
    setSummary({ new: data.newCount, dup: data.duplicateCount });
    setStep(2);
  }

  function patchRow(i: number, patch: Partial<StagedRow>) {
    setRows((prev) => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  }

  async function onCommit() {
    if (!importId) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/bank-accounts/import/${importId}/commit`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ txns: rows }),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error); return; }
    setStep(3);
    router.refresh();
  }

  if (step === 1) {
    return (
      <form onSubmit={onUpload} className="ab-card p-4 space-y-3 max-w-xl">
        <label className="block">
          <span className="block text-sm mb-1">Account</span>
          <select className="ab-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm mb-1">PDF</span>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button disabled={busy || !file || !accountId} className="ab-btn ab-btn-accent">{busy ? "Extracting…" : "Upload & Extract"}</button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-3">
        {summary && (
          <p className="text-sm text-[#a0a0a5]">
            {summary.new} new · {summary.dup} duplicates auto-skipped · edit below, then commit.
          </p>
        )}
        <table className="w-full text-xs ab-card">
          <thead><tr className="text-left text-[#a0a0a5]">
            <th className="p-2">Date</th><th className="p-2">Description</th>
            <th className="p-2 text-right">Amount</th><th className="p-2">Dir</th>
            <th className="p-2">Category</th><th className="p-2">Skip</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-[#2a2a2e] ${r.isDuplicate ? "opacity-50" : ""}`}>
                <td className="p-2">{r.txnDate}</td>
                <td className="p-2">{r.description}</td>
                <td className="p-2 text-right">{r.amount.toFixed(2)}</td>
                <td className="p-2">{r.direction}</td>
                <td className="p-2">
                  <select className="ab-input" value={r.categoryId ?? ""} onChange={(e) => patchRow(i, { categoryId: e.target.value || null, categorySource: "user" })}>
                    <option value="">— none —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={r.skip} onChange={(e) => patchRow(i, { skip: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <button className="ab-btn ab-btn-ghost" onClick={() => setStep(1)}>Back</button>
          <button className="ab-btn ab-btn-accent" onClick={onCommit} disabled={busy}>{busy ? "Committing…" : "Commit Import"}</button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="ab-card p-4 space-y-3">
      <p>Import saved. Open the <a className="underline" href="/dashboard/bank-accounts">overview</a> to see analytics, or <a className="underline" href="/dashboard/bank-accounts/list">list</a> to browse.</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/import
git commit -m "feat(bank-accounts): import wizard (upload/preview/commit)"
```

---

## Task 25: UI — Transaction list page

**Files:**
- Create: `src/app/dashboard/bank-accounts/list/page.tsx`
- Create: `src/app/dashboard/bank-accounts/list/transactions-table.tsx`

- [ ] **Step 1: Server page (reads URL search params, renders client table)**

```tsx
// src/app/dashboard/bank-accounts/list/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { TransactionsTable } from "./transactions-table";

export default async function ListPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId, disabled: false }, orderBy: { label: "asc" } }),
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Transactions</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">All imported transactions across your accounts.</p>
      </div>
      <TransactionsTable
        accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Client table with URL-synced filters**

```tsx
// src/app/dashboard/bank-accounts/list/transactions-table.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Row {
  id: string;
  txnDate: string;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; label: string };
  notes: string | null;
}

export function TransactionsTable({
  accounts, categories,
}: { accounts: { id: string; label: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(sp.get("page") ?? "1"));

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const accountId = sp.get("accountId") ?? "";
  const categoryId = sp.get("categoryId") ?? "";
  const direction = sp.get("direction") ?? "";
  const q = sp.get("q") ?? "";

  const fetchRows = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (direction) params.set("direction", direction);
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", "50");
    const r = await fetch(`/api/bank-accounts/transactions?${params}`);
    if (!r.ok) return;
    const data = await r.json() as { items: Row[]; total: number };
    setRows(data.items);
    setTotal(data.total);
  }, [from, to, accountId, categoryId, direction, q, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value); else next.delete(key);
    next.set("page", "1");
    setPage(1);
    router.replace(`?${next.toString()}`);
  }

  async function updateCategory(id: string, newCategoryId: string) {
    const r = await fetch(`/api/bank-accounts/transactions/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: newCategoryId || null }),
    });
    if (!r.ok) return;
    const row = rows.find((x) => x.id === id);
    if (row && newCategoryId) {
      const pattern = window.prompt(
        "Create a merchant rule?",
        row.description.replace(/\d{6,}/g, "").trim().toUpperCase(),
      );
      if (pattern) {
        const also = confirm("Also re-categorize past transactions matching this pattern?");
        await fetch("/api/bank-accounts/transactions/categorize", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transactionIds: [id],
            categoryId: newCategoryId,
            createRule: { pattern },
            recategorizePast: also,
          }),
        });
      }
    }
    fetchRows();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input className="ab-input" type="date" value={from} onChange={(e) => updateFilter("from", e.target.value)} />
        <input className="ab-input" type="date" value={to} onChange={(e) => updateFilter("to", e.target.value)} />
        <select className="ab-input" value={accountId} onChange={(e) => updateFilter("accountId", e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select className="ab-input" value={categoryId} onChange={(e) => updateFilter("categoryId", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="ab-input" value={direction} onChange={(e) => updateFilter("direction", e.target.value)}>
          <option value="">Both</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <input className="ab-input" placeholder="Search description" value={q} onChange={(e) => updateFilter("q", e.target.value)} />
      </div>

      <table className="w-full text-sm ab-card">
        <thead><tr className="text-left text-[#a0a0a5]">
          <th className="p-3">Date</th><th className="p-3">Description</th>
          <th className="p-3">Account</th><th className="p-3">Category</th>
          <th className="p-3 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#2a2a2e]">
              <td className="p-3">{r.txnDate.slice(0, 10)}</td>
              <td className="p-3">{r.description}</td>
              <td className="p-3">{r.account.label}</td>
              <td className="p-3">
                <select className="ab-input" value={r.categoryId ?? ""} onChange={(e) => updateCategory(r.id, e.target.value)}>
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td className={`p-3 text-right ${r.direction === "credit" ? "text-green-500" : "text-red-400"}`}>
                {r.direction === "credit" ? "+" : "-"}{r.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[#a0a0a5]">{total} total</span>
        <div className="flex gap-2">
          <button className="ab-btn ab-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page}</span>
          <button className="ab-btn ab-btn-ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/list
git commit -m "feat(bank-accounts): transaction list with filters + inline categorize"
```

---

## Task 26: UI — Chart components

**Files:**
- Create: `src/components/bank-accounts/month-picker.tsx`
- Create: `src/components/bank-accounts/stat-cards.tsx`
- Create: `src/components/bank-accounts/category-breakdown-chart.tsx`
- Create: `src/components/bank-accounts/month-trend-chart.tsx`
- Create: `src/components/bank-accounts/top-merchants-list.tsx`
- Create: `src/components/bank-accounts/daily-heatmap.tsx`
- Create: `src/components/bank-accounts/income-expense-chart.tsx`

- [ ] **Step 1: Month picker**

```tsx
// src/components/bank-accounts/month-picker.tsx
"use client";
export function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  function step(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  }
  const label = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="flex items-center gap-2">
      <button className="ab-btn ab-btn-ghost" onClick={() => step(-1)}>‹</button>
      <span className="min-w-[140px] text-center">{label}</span>
      <button className="ab-btn ab-btn-ghost" onClick={() => step(1)}>›</button>
    </div>
  );
}
```

- [ ] **Step 2: Stat cards**

```tsx
// src/components/bank-accounts/stat-cards.tsx
export function StatCards({ spending, income, net, count }: { spending: number; income: number; net: number; count: number }) {
  const cards = [
    { label: "Total Spending", value: spending, tone: "text-red-400" },
    { label: "Total Income",   value: income,   tone: "text-green-500" },
    { label: "Net",            value: net,      tone: net >= 0 ? "text-green-500" : "text-red-400" },
    { label: "Transactions",   value: count,    tone: "text-[#ededed]", isCount: true as const },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="ab-card p-4">
          <div className="text-sm text-[#a0a0a5]">{c.label}</div>
          <div className={`text-2xl font-semibold mt-1 ${c.tone}`}>
            {c.isCount ? c.value : `₹${c.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Category breakdown (horizontal bars)**

```tsx
// src/components/bank-accounts/category-breakdown-chart.tsx
"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CategoryBreakdownChart({ data, onSelect }: {
  data: { categoryId: string | null; name: string; total: number }[];
  onSelect: (categoryId: string | null) => void;
}) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Category Breakdown</h3>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" stroke="#a0a0a5" />
            <YAxis type="category" dataKey="name" stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Bar dataKey="total" fill="#ff385c" onClick={(d) => onSelect((d as unknown as { categoryId: string | null }).categoryId)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Month trend**

```tsx
// src/components/bank-accounts/month-trend-chart.tsx
"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MonthTrendChart({ data, onMonthClick }: {
  data: { month: string; spending: number; income: number }[];
  onMonthClick: (month: string) => void;
}) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Month-over-Month</h3>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="#2a2a2e" />
            <XAxis dataKey="month" stroke="#a0a0a5" />
            <YAxis stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Legend />
            <Bar dataKey="spending" fill="#ef4444" onClick={(d) => onMonthClick((d as unknown as { month: string }).month)} />
            <Bar dataKey="income"   fill="#10b981" onClick={(d) => onMonthClick((d as unknown as { month: string }).month)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Top merchants list**

```tsx
// src/components/bank-accounts/top-merchants-list.tsx
export function TopMerchantsList({ items }: { items: { normalizedDescription: string; total: number; count: number }[] }) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Top Merchants</h3>
      <table className="w-full text-sm">
        <tbody>
          {items.map((m, i) => (
            <tr key={i} className="border-t border-[#2a2a2e] first:border-none">
              <td className="py-2 pr-2 truncate max-w-[260px]">{m.normalizedDescription}</td>
              <td className="py-2 text-right text-[#a0a0a5]">{m.count}×</td>
              <td className="py-2 text-right">₹{m.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Daily heatmap**

```tsx
// src/components/bank-accounts/daily-heatmap.tsx
"use client";
export function DailyHeatmap({ year, month, data, onDayClick }: {
  year: number; month: number;
  data: Record<string, number>;
  onDayClick: (dateIso: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: Array<{ iso: string; value: number } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, value: data[iso] ?? 0 });
  }
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Daily Spending</h3>
      <div className="grid grid-cols-7 gap-1">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-xs text-[#a0a0a5] text-center">{d}</div>)}
        {cells.map((c, i) => (
          c === null
            ? <div key={i} />
            : <button key={i} onClick={() => onDayClick(c.iso)}
                className="aspect-square rounded text-[10px] text-[#ededed]"
                style={{ background: c.value === 0 ? "#1a1a1e" : `rgba(255,56,92,${0.2 + 0.8 * c.value / max})` }}
                title={`${c.iso}: ₹${c.value.toLocaleString("en-IN")}`}>
                {c.iso.slice(-2)}
              </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Income vs expense line chart**

```tsx
// src/components/bank-accounts/income-expense-chart.tsx
"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function IncomeExpenseChart({ data }: { data: { month: string; spending: number; income: number }[] }) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Income vs Expense</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid stroke="#2a2a2e" />
            <XAxis dataKey="month" stroke="#a0a0a5" />
            <YAxis stroke="#a0a0a5" />
            <Tooltip contentStyle={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }} />
            <Legend />
            <Area type="monotone" dataKey="income"   stroke="#10b981" fill="#10b98133" />
            <Area type="monotone" dataKey="spending" stroke="#ef4444" fill="#ef444433" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/bank-accounts
git commit -m "feat(bank-accounts): chart components (views A–E)"
```

---

## Task 27: UI — Overview page (views A–E)

**Files:**
- Create: `src/app/dashboard/bank-accounts/page.tsx`
- Create: `src/app/dashboard/bank-accounts/overview-client.tsx`

- [ ] **Step 1: Server page — load accounts for selector, render client**

```tsx
// src/app/dashboard/bank-accounts/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { OverviewClient } from "./overview-client";

export default async function BankAccountsOverview() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const accounts = await prisma.bankAccount.findMany({
    where: { userId, disabled: false }, orderBy: { label: "asc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Bank Accounts</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Import statements and analyse spending.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bank-accounts/list" className="ab-btn ab-btn-ghost">Transactions</Link>
          <Link href="/dashboard/bank-accounts/accounts" className="ab-btn ab-btn-ghost">Accounts</Link>
          <Link href="/dashboard/bank-accounts/categories" className="ab-btn ab-btn-ghost">Categories</Link>
          <Link href="/dashboard/bank-accounts/imports" className="ab-btn ab-btn-ghost">Imports</Link>
          <Link href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent">
            <Upload size={15} /> Import Statement
          </Link>
        </div>
      </div>
      <OverviewClient accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
    </div>
  );
}
```

- [ ] **Step 2: Client overview — month-picker + account selector + five views**

```tsx
// src/app/dashboard/bank-accounts/overview-client.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/bank-accounts/month-picker";
import { StatCards } from "@/components/bank-accounts/stat-cards";
import { CategoryBreakdownChart } from "@/components/bank-accounts/category-breakdown-chart";
import { MonthTrendChart } from "@/components/bank-accounts/month-trend-chart";
import { TopMerchantsList } from "@/components/bank-accounts/top-merchants-list";
import { DailyHeatmap } from "@/components/bank-accounts/daily-heatmap";
import { IncomeExpenseChart } from "@/components/bank-accounts/income-expense-chart";

interface Summary {
  stats: { spending: number; income: number; net: number; count: number };
  monthTrend: { month: string; spending: number; income: number }[];
  heatmap: Record<string, number>;
  incomeExpense: { month: string; spending: number; income: number }[];
}

export function OverviewClient({ accounts }: { accounts: { id: string; label: string }[] }) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [accountId, setAccountId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<{ categoryId: string | null; name: string; total: number }[]>([]);
  const [merchants, setMerchants] = useState<{ normalizedDescription: string; total: number; count: number }[]>([]);

  const fetchAll = useCallback(async () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (accountId) qs.set("accountId", accountId);
    const [s, c, m] = await Promise.all([
      fetch(`/api/bank-accounts/analytics/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/bank-accounts/analytics/categories?${qs}&direction=debit`).then((r) => r.json()),
      fetch(`/api/bank-accounts/analytics/merchants?${qs}&limit=10`).then((r) => r.json()),
    ]);
    setSummary(s);
    setCategories(c.categories);
    setMerchants(m.merchants);
  }, [year, month, accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function drillToList(extra: Record<string, string>) {
    const qs = new URLSearchParams(extra);
    if (accountId) qs.set("accountId", accountId);
    router.push(`/dashboard/bank-accounts/list?${qs}`);
  }

  const mmStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const mmEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <select className="ab-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <StatCards {...(summary?.stats ?? { spending: 0, income: 0, net: 0, count: 0 })} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownChart
          data={categories}
          onSelect={(categoryId) => drillToList({ from: mmStart, to: mmEnd, ...(categoryId ? { categoryId } : {}) })}
        />
        <MonthTrendChart
          data={summary?.monthTrend ?? []}
          onMonthClick={(m) => { const [y, mm] = m.split("-").map(Number); setYear(y); setMonth(mm); }}
        />
        <TopMerchantsList items={merchants} />
        <DailyHeatmap
          year={year} month={month}
          data={summary?.heatmap ?? {}}
          onDayClick={(iso) => drillToList({ from: iso, to: iso })}
        />
      </div>
      <IncomeExpenseChart data={summary?.incomeExpense ?? []} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/page.tsx src/app/dashboard/bank-accounts/overview-client.tsx
git commit -m "feat(bank-accounts): overview page with views A–E"
```

---

## Task 28: UI — Imports history page

**Files:**
- Create: `src/app/dashboard/bank-accounts/imports/page.tsx`
- Create: `src/app/dashboard/bank-accounts/imports/imports-list.tsx`

- [ ] **Step 1: Server page + rule-coverage stat**

```tsx
// src/app/dashboard/bank-accounts/imports/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { ImportsList } from "./imports-list";

export default async function ImportsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [imports, totals, ruleCovered, total] = await Promise.all([
    prisma.statementImport.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      include: { account: true },
    }),
    prisma.statementImport.aggregate({
      where: { userId }, _sum: { claudeCostUsd: true },
    }),
    prisma.transaction.count({ where: { userId, categorySource: "rule" } }),
    prisma.transaction.count({ where: { userId } }),
  ]);
  const recentCost = imports.slice(0, 10).reduce((s, i) => s + (i.claudeCostUsd ?? 0), 0);
  const coverage = total === 0 ? 0 : Math.round((ruleCovered / total) * 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Imports</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Total API cost: ${totals._sum.claudeCostUsd?.toFixed(2) ?? "0.00"} ·
          Last 10 imports: ${recentCost.toFixed(2)} ·
          Rules cover {coverage}% of transactions
        </p>
      </div>
      <ImportsList items={imports.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        statementPeriodStart: i.statementPeriodStart?.toISOString() ?? null,
        statementPeriodEnd: i.statementPeriodEnd?.toISOString() ?? null,
        account: { id: i.account.id, label: i.account.label },
      }))} />
    </div>
  );
}
```

- [ ] **Step 2: Client list**

```tsx
// src/app/dashboard/bank-accounts/imports/imports-list.tsx
"use client";
import { useRouter } from "next/navigation";

interface Item {
  id: string; fileName: string; status: string;
  account: { id: string; label: string };
  statementPeriodStart: string | null; statementPeriodEnd: string | null;
  extractedCount: number; newCount: number; duplicateCount: number;
  claudeCostUsd: number | null;
  createdAt: string;
  errorMessage: string | null;
}

export function ImportsList({ items }: { items: Item[] }) {
  const router = useRouter();
  async function remove(id: string) {
    if (!confirm("Delete this import and all its saved transactions?")) return;
    await fetch(`/api/bank-accounts/import/${id}`, { method: "DELETE" });
    router.refresh();
  }
  if (items.length === 0) return <p className="text-sm text-[#a0a0a5]">No imports yet.</p>;
  return (
    <table className="w-full text-sm ab-card">
      <thead><tr className="text-left text-[#a0a0a5]">
        <th className="p-3">File</th><th className="p-3">Account</th><th className="p-3">Period</th>
        <th className="p-3">Status</th><th className="p-3 text-right">Txns</th>
        <th className="p-3 text-right">Cost</th><th className="p-3"></th>
      </tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-t border-[#2a2a2e]">
            <td className="p-3">{i.fileName}</td>
            <td className="p-3">{i.account.label}</td>
            <td className="p-3 text-[#a0a0a5]">
              {i.statementPeriodStart ? `${i.statementPeriodStart.slice(0, 10)} → ${i.statementPeriodEnd?.slice(0, 10) ?? "?"}` : "—"}
            </td>
            <td className="p-3">{i.status}{i.errorMessage ? ` — ${i.errorMessage}` : ""}</td>
            <td className="p-3 text-right">{i.newCount}/{i.extractedCount}</td>
            <td className="p-3 text-right">{i.claudeCostUsd ? `$${i.claudeCostUsd.toFixed(4)}` : "—"}</td>
            <td className="p-3 text-right"><button onClick={() => remove(i.id)} className="text-red-500 underline">Delete</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/bank-accounts/imports
git commit -m "feat(bank-accounts): imports history page with cost + rule coverage"
```

---

## Task 29: End-to-end verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all new suites (`normalize-description`, `dedup`, `merchant-rules`, `transfer-detect`, `aggregations`) pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Manual walkthrough**

1. `npm run dev`
2. Sidebar shows "Bank Accounts".
3. Open `/dashboard/bank-accounts/accounts` → add an account (label "HDFC Savings", bankName "HDFC").
4. Open `/dashboard/bank-accounts/categories` → confirm 13 preset categories visible; add one custom.
5. Open `/dashboard/bank-accounts/import` → select account, upload a real bank statement PDF.
6. After extraction, preview shows dates, amounts, directions, some categories pre-filled. Banner shows `N new · M duplicates auto-skipped`.
7. Commit. Redirect/refresh shows "Import saved" step.
8. Open `/dashboard/bank-accounts` → month picker defaults to current month; stat cards, category chart, month trend, top merchants, heatmap, income-vs-expense all render.
9. Open `/dashboard/bank-accounts/list` → rows visible; filter by account and date, verify URL updates. Change a category inline → when prompted, create a merchant rule; confirm it appears under `/dashboard/bank-accounts/categories`.
10. Re-upload the same PDF → preview shows all rows as `isDuplicate`, newCount=0, commit inserts nothing.
11. Add a second account; import a statement where a debit on account 1 matches a credit on account 2 (same day, same amount); after commit, both rows show Transfer category in the list and are excluded from spending totals on overview.
12. Open `/dashboard/bank-accounts/imports` → footer shows running cost and rule coverage %.

- [ ] **Step 4: No commit (verification only).**

---

## Self-Review Notes

- **Spec coverage:**
  - Data model (5 tables) → Task 1 ✓
  - Preset categories → Task 2 ✓
  - Pure utilities (normalize, dedup, rules, transfer-detect, aggregations) → Tasks 4–8 ✓
  - Extraction (text + Claude document block, prompt caching, cost tracking) → Tasks 9–10 ✓
  - Rules-first → Claude-fallback categorization → Task 11 ✓
  - Accounts / Categories / Rules CRUD → Tasks 12–14 ✓
  - Upload / extract / commit + transfer detection → Tasks 15–18 ✓
  - Transactions list + correction flow (with rule creation + past recategorization) → Task 19 ✓
  - Analytics (summary, categories, merchants) → Task 20 ✓
  - Sidebar nav → Task 21 ✓
  - UI pages: accounts, categories, import wizard, transaction list, overview views A–E, imports history → Tasks 22–28 ✓
  - E2E verification incl. dedup, transfer detection, rule learning → Task 29 ✓
- **Placeholder scan:** No TBD/TODO. Every code step has complete code. Task 15 Step 2 asks the implementer to mirror an existing file reader (`/api/fd/file/[name]`) — that's concrete guidance, not a placeholder.
- **Type consistency:** `ExtractedTxn`, `StagedTxn`, `CategoryLite`, `Direction`, `CategoryKind`, `CategorySource`, `ImportStatus` defined in Task 3 and used consistently in Tasks 10, 11, 16, 17, 24. `RuleLite` defined in Task 6 and re-exported usage is by module import — matches between Task 11 (`categorize.ts`) and Task 16 (extract route).
- **Next 16 note:** Every dynamic route handler types `params` as `Promise<{ id: string }>` — matches AGENTS.md warning.
- **Reconciliations from spec applied:** Float (not Decimal) for amounts; DateTime (not YYYY-MM-DD strings) for dates; `pdf-parse` (not `pdfjs-dist`); vitest (not "no test framework").
