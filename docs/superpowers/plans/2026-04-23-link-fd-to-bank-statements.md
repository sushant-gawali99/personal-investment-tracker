# Link Fixed Deposits to Bank Statement Transactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone FD-statement import system and auto-link FD-related transactions (interest, maturity, TDS, transfers) from normal bank statement imports to their matching `FixedDeposit`, surfacing the link on both the FD detail page and the bank transactions list.

**Architecture:** Replace the parallel `FDStatement` / `FDStatementTxn` flow with two nullable columns on `Transaction` (`fdId`, `fdTxnType`). A new `src/lib/fd-link/` module owns detection (FD-number regex, exact/suffix match, transaction-type classification) — the logic moves over from the deleted `src/lib/fd-statement/`. Detection fires at two triggers: (a) after a bank-statement commit inserts new `Transaction` rows, and (b) after an FD is created or its FD/account number changes. Linked transactions also get auto-categorized into four seeded categories (FD Interest / FD Maturity / TDS / Transfer) unless the user has set the category manually.

**Tech Stack:** Next.js 16.2.4 (app router), Prisma 7 with libSQL (`prisma db push` against Turso — no migration files), `vitest` 4 for tests, shadcn + project-local `ab-*` CSS classes. Existing utilities: `getSessionUserId` / `requireUserId` from `src/lib/session.ts`.

**Spec:** `docs/superpowers/specs/2026-04-23-link-fd-to-bank-statements-design.md`

**Conventions:**
- Every prisma change is pushed with `npx prisma db push` — there is no `prisma/migrations/` folder.
- Tests use vitest: run a single file with `npx vitest run <path>`, the whole suite with `npm test`.
- Follow the existing pattern in `commit-import.ts` for fire-and-forget link passes (errors logged, not thrown).

---

## File Structure

**Create (new)**
- `src/lib/fd-link/types.ts` — `FdTxnType`, `MatchCandidate`, `MatchResult` (migrated from `fd-statement/types.ts`)
- `src/lib/fd-link/classify.ts` (+ `.test.ts`) — moved from `fd-statement/`
- `src/lib/fd-link/match.ts` (+ `.test.ts`) — moved from `fd-statement/`
- `src/lib/fd-link/categories.ts` (+ `.test.ts`) — resolve/seed the four FD-linked `TransactionCategory` rows
- `src/lib/fd-link/link.ts` (+ `.test.ts`) — pure `linkTransactionToFd(txn, fds, categoryMap)` function
- `src/lib/fd-link/link-batch.ts` — orchestration: `linkTransactionsAfterImport(userId)` + `linkTransactionsForFd(userId, fdId)`
- `src/app/dashboard/fd/fd-txn-section.tsx` — moved from `fd/statements/fd-txn-section.tsx`

**Modify**
- `prisma/schema.prisma` — add `fdId` + `fdTxnType` to `Transaction`, add `FixedDeposit.transactions` back-relation, drop `FDStatement` + `FDStatementTxn`
- `src/lib/bank-accounts/commit-import.ts` — call `linkTransactionsAfterImport` after the transfer-detect pass
- `src/app/api/fd/route.ts` — call `linkTransactionsForFd` after create / overwrite
- `src/app/api/fd/[id]/route.ts` — call `linkTransactionsForFd` after PATCH when FD/account number changes
- `src/app/dashboard/fd/page.tsx` — source `txns` from `Transaction` (not `FDStatementTxn`); drop the Statements CTA
- `src/app/dashboard/fd/[id]/page.tsx` — source `txns` from `Transaction`
- `src/app/dashboard/fd/fd-detail-content.tsx` — update the `FdTxnSection` import path and `FdTxnRow.statementId` removal
- `src/app/dashboard/fd/fd-list.tsx` — adjust the `FD` type if the `statementId` field drops
- `src/app/api/bank-accounts/transactions/route.ts` — include the related FD so the list can render the pill
- `src/app/dashboard/bank-accounts/list/transactions-table.tsx` — render the FD pill next to the description

**Delete**
- `src/app/dashboard/fd/statements/` (whole subtree: `page.tsx`, `statements-list.tsx`, `fd-txn-section.tsx` [after the move], `new/page.tsx`, `new/statement-upload-form.tsx`, `[id]/page.tsx`)
- `src/app/api/fd/statements/` (whole subtree: `route.ts`, `parse/route.ts`, `[id]/route.ts`, `[id]/pdf/route.ts`)
- `src/lib/fd-statement/` (whole directory — contents move to `fd-link/` first, then delete)

---

## Task 1: Prisma schema — drop FDStatement/FDStatementTxn, add fdId + fdTxnType to Transaction

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`:

1. **Delete** the `model FDStatement { ... }` block (the current lines roughly 111–126).
2. **Delete** the `model FDStatementTxn { ... }` block (the current lines roughly 128–144).
3. In `model FixedDeposit`, replace:
   ```prisma
   statementTxns  FDStatementTxn[]
   ```
   with:
   ```prisma
   transactions   Transaction[]
   ```
4. In `model Transaction`, add these two fields (right after `categorySource`):
   ```prisma
   fdId                    String?
   fd                      FixedDeposit? @relation(fields: [fdId], references: [id], onDelete: SetNull)
   fdTxnType               String?
   ```
   And add this index inside the same model alongside the existing `@@index` lines:
   ```prisma
   @@index([fdId])
   ```

- [ ] **Step 2: Push the schema to the database**

Run: `npx prisma db push`
Expected: Prints "Your database is now in sync with your Prisma schema." — no prompts about data loss (the FDStatement / FDStatementTxn tables get dropped; that's the intended behaviour).

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client … to ./node_modules/@prisma/client".

- [ ] **Step 4: Verify the generated client exposes the new shape**

Run: `npx tsc --noEmit -p tsconfig.json` (or `npm run build` if there's no tsc script — see `package.json`).
Expected: Compile errors in exactly the files listed in "Delete" / "Modify" sections above (`fd-statement/*`, `api/fd/statements/*`, `dashboard/fd/statements/*`, `dashboard/fd/page.tsx`, `dashboard/fd/[id]/page.tsx`). Those errors are expected — later tasks delete or rewrite those files.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: replace FD statement tables with fdId on Transaction"
```

---

## Task 2: Move fd-statement detection lib to fd-link (classify, match, types)

**Files:**
- Create: `src/lib/fd-link/types.ts`, `src/lib/fd-link/classify.ts`, `src/lib/fd-link/classify.test.ts`, `src/lib/fd-link/match.ts`, `src/lib/fd-link/match.test.ts`
- (Do not delete the `fd-statement/` originals yet — Task 9 deletes the whole directory once nothing imports from it.)

- [ ] **Step 1: Create `src/lib/fd-link/types.ts`**

```ts
export type FdTxnType =
  | "interest"
  | "maturity"
  | "premature_close"
  | "transfer_in"
  | "transfer_out"
  | "tds"
  | "other";

export interface MatchCandidate {
  fdId: string;
  fdNumber: string | null;
  accountNumber: string | null;
}

export type MatchResult =
  | { kind: "matched"; fdId: string }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "none" };
```

(This drops the unused `ParsedTxn`, `label`, and `maturityDate` fields from the old `fd-statement/types.ts` — they were only needed by the deleted PDF parser.)

- [ ] **Step 2: Create `src/lib/fd-link/classify.ts`** (content identical to `fd-statement/classify.ts` but imports the new types)

```ts
import type { FdTxnType } from "./types";

const FD_NUM_RE = /FD[-\s]?(?:NO\s+)?(\d{3,})/i;

export function classifyRow(particulars: string): { type: FdTxnType; detectedFdNumber: string | null } {
  const p = particulars.trim();
  const upper = p.toUpperCase();
  const fdMatch = p.match(FD_NUM_RE);
  const detectedFdNumber = fdMatch ? fdMatch[1] : null;

  if (/TDS/.test(upper)) return { type: "tds", detectedFdNumber: null };

  if (/PREMAT|PRECLOSE|PREMATURE/.test(upper) && detectedFdNumber) {
    return { type: "premature_close", detectedFdNumber };
  }
  if (/TR\s+TO\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_out", detectedFdNumber };
  }
  if (/TRANSFER\s+FR\s+FD|TRANSFER\s+FROM\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_in", detectedFdNumber };
  }
  if (/\bINT\b|INTEREST/.test(upper) && detectedFdNumber) {
    return { type: "interest", detectedFdNumber };
  }
  if (/\bMAT\b/.test(upper) && /CLSD|CLOSED/.test(upper) && detectedFdNumber) {
    return { type: "maturity", detectedFdNumber };
  }
  return { type: "other", detectedFdNumber };
}
```

- [ ] **Step 3: Create `src/lib/fd-link/classify.test.ts`** (copy of the old test, import path updated)

```ts
import { describe, it, expect } from "vitest";
import { classifyRow } from "./classify";

describe("classifyRow", () => {
  it("classifies interest from 'Int. FD-999030244019507'", () => {
    expect(classifyRow("Int. FD-999030244019507")).toEqual({
      type: "interest",
      detectedFdNumber: "999030244019507",
    });
  });
  it("classifies interest from 'FD NO 16984 MAT INT'", () => {
    expect(classifyRow("FD NO 16984 MAT INT")).toEqual({
      type: "interest",
      detectedFdNumber: "16984",
    });
  });
  it("classifies maturity 'MAT FD 18883 CLSD'", () => {
    expect(classifyRow("MAT FD 18883 CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "18883",
    });
  });
  it("classifies maturity 'FD 11713 MAT AND CLSD'", () => {
    expect(classifyRow("FD 11713 MAT AND CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "11713",
    });
  });
  it("classifies premature from 'FD 999 PREMAT CLSD'", () => {
    expect(classifyRow("FD 999 PREMAT CLSD")).toEqual({
      type: "premature_close",
      detectedFdNumber: "999",
    });
  });
  it("classifies transfer_out 'TR TO FD 999030244024577'", () => {
    expect(classifyRow("TR TO FD 999030244024577")).toEqual({
      type: "transfer_out",
      detectedFdNumber: "999030244024577",
    });
  });
  it("classifies transfer_in 'Transfer fr FD-999030244023539'", () => {
    expect(classifyRow("Transfer fr FD-999030244023539")).toEqual({
      type: "transfer_in",
      detectedFdNumber: "999030244023539",
    });
  });
  it("classifies tds 'TDS Deducted-SB-DENGLE RAVINDRA'", () => {
    expect(classifyRow("TDS Deducted-SB-DENGLE RAVINDRA")).toEqual({
      type: "tds",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'Interest Post' without FD number", () => {
    expect(classifyRow("Interest Post")).toEqual({
      type: "other",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'To RD 999020244000802'", () => {
    const r = classifyRow("To RD 999020244000802");
    expect(r.type).toBe("other");
  });
});
```

- [ ] **Step 4: Create `src/lib/fd-link/match.ts`** (content identical to `fd-statement/match.ts` but imports new types)

```ts
import type { MatchCandidate, MatchResult } from "./types";

export function matchFd(detected: string | null, fds: MatchCandidate[]): MatchResult {
  if (!detected) return { kind: "none" };
  const d = detected.replace(/^FD[-\s]?/i, "");
  const exact = fds.filter((f) => f.fdNumber === d || f.accountNumber === d || f.accountNumber === detected);
  if (exact.length === 1) return { kind: "matched", fdId: exact[0].fdId };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact.map((f) => f.fdId) };

  const suffix = fds.filter((f) => {
    if (!f.fdNumber) return false;
    return f.fdNumber.endsWith(d) || d.endsWith(f.fdNumber);
  });
  if (suffix.length === 1) return { kind: "matched", fdId: suffix[0].fdId };
  if (suffix.length > 1) return { kind: "ambiguous", candidates: suffix.map((f) => f.fdId) };
  return { kind: "none" };
}
```

- [ ] **Step 5: Create `src/lib/fd-link/match.test.ts`** (copy of the old test with the new import and the trimmed `MatchCandidate` shape)

```ts
import { describe, it, expect } from "vitest";
import { matchFd } from "./match";
import type { MatchCandidate } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "a", fdNumber: "999030244019507", accountNumber: null },
  { fdId: "b", fdNumber: "999030244018883", accountNumber: null },
  { fdId: "c", fdNumber: "16984",           accountNumber: null },
  { fdId: "d", fdNumber: null,              accountNumber: "FD-13582" },
];

describe("matchFd", () => {
  it("exact match on fdNumber", () => {
    expect(matchFd("999030244019507", fds)).toEqual({ kind: "matched", fdId: "a" });
  });
  it("exact match on accountNumber (ignoring prefix)", () => {
    expect(matchFd("FD-13582", fds)).toEqual({ kind: "matched", fdId: "d" });
  });
  it("suffix fallback: short detected suffix of stored fdNumber", () => {
    expect(matchFd("18883", fds)).toEqual({ kind: "matched", fdId: "b" });
  });
  it("suffix fallback: stored short fdNumber is suffix of detected long", () => {
    expect(matchFd("999930016984", fds)).toEqual({ kind: "matched", fdId: "c" });
  });
  it("none when no candidates", () => {
    expect(matchFd("11111", fds)).toEqual({ kind: "none" });
  });
  it("ambiguous when multiple suffixes match", () => {
    const ambig: MatchCandidate[] = [
      { fdId: "x", fdNumber: "123999", accountNumber: null },
      { fdId: "y", fdNumber: "456999", accountNumber: null },
    ];
    expect(matchFd("999", ambig)).toEqual({ kind: "ambiguous", candidates: ["x", "y"] });
  });
  it("returns none when detected is null", () => {
    expect(matchFd(null, fds)).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run src/lib/fd-link/classify.test.ts src/lib/fd-link/match.test.ts`
Expected: 17 tests pass (10 classify + 7 match).

- [ ] **Step 7: Commit**

```bash
git add src/lib/fd-link/
git commit -m "feat(fd-link): copy classify + match detection from fd-statement module"
```

---

## Task 3: FD category resolver — `fd-link/categories.ts`

Resolves (or seeds) the four `TransactionCategory` rows that FD-linked transactions get assigned to. Returns a map keyed by `FdTxnType`.

**Files:**
- Create: `src/lib/fd-link/categories.ts`, `src/lib/fd-link/categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fd-link/categories.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveFdCategories, FD_TXN_TYPE_TO_CATEGORY_NAME } from "./categories";

type Row = { id: string; userId: string | null; name: string; kind: string };

function makeFakeDb(initial: Row[]) {
  const rows = [...initial];
  let nextId = 100;
  return {
    rows,
    transactionCategory: {
      findMany: vi.fn(async (args: { where: { userId: { in: (string | null)[] }; name: { in: string[] } } }) => {
        const { userId, name } = args.where;
        return rows.filter((r) => userId.in.includes(r.userId) && name.in.includes(r.name));
      }),
      create: vi.fn(async (args: { data: Omit<Row, "id"> }) => {
        const row = { ...args.data, id: `new-${nextId++}` };
        rows.push(row);
        return row;
      }),
    },
  };
}

describe("resolveFdCategories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps all six fd txn types to category IDs", async () => {
    const db = makeFakeDb([]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("interest")).toBeTruthy();
    expect(map.get("maturity")).toBeTruthy();
    expect(map.get("premature_close")).toBe(map.get("maturity"));
    expect(map.get("tds")).toBeTruthy();
    expect(map.get("transfer_in")).toBe(map.get("transfer_out"));
    expect(map.get("other")).toBeUndefined();
  });

  it("reuses an existing user-scoped category with the same name", async () => {
    const db = makeFakeDb([
      { id: "existing-tds", userId: "user-1", name: "TDS", kind: "expense" },
    ]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("tds")).toBe("existing-tds");
    // Create was called for the three missing names, not for TDS.
    const createdNames = db.transactionCategory.create.mock.calls.map((c) => c[0].data.name);
    expect(createdNames).not.toContain("TDS");
    expect(createdNames).toContain("FD Interest");
    expect(createdNames).toContain("FD Maturity");
    expect(createdNames).toContain("Transfer");
  });

  it("reuses a preset (userId=null) category when present", async () => {
    const db = makeFakeDb([
      { id: "preset-transfer", userId: null, name: "Transfer", kind: "transfer" },
    ]);
    const map = await resolveFdCategories(db as never, "user-1");
    expect(map.get("transfer_in")).toBe("preset-transfer");
    expect(map.get("transfer_out")).toBe("preset-transfer");
  });

  it("creates new categories with the expected kind", async () => {
    const db = makeFakeDb([]);
    await resolveFdCategories(db as never, "user-1");
    const created = db.transactionCategory.create.mock.calls.map((c) => c[0].data);
    const byName = Object.fromEntries(created.map((r) => [r.name, r]));
    expect(byName["FD Interest"].kind).toBe("income");
    expect(byName["FD Maturity"].kind).toBe("income");
    expect(byName["TDS"].kind).toBe("expense");
    expect(byName["Transfer"].kind).toBe("transfer");
    for (const row of created) {
      expect(row.userId).toBe("user-1");
    }
  });

  it("exports a type→name mapping that covers all six types", () => {
    expect(Object.keys(FD_TXN_TYPE_TO_CATEGORY_NAME).sort()).toEqual([
      "interest", "maturity", "premature_close", "tds", "transfer_in", "transfer_out",
    ].sort());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/fd-link/categories.test.ts`
Expected: FAIL — `Cannot find module './categories'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/fd-link/categories.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import type { FdTxnType } from "./types";

/**
 * Maps every FD transaction type (except "other") to the *display name* of
 * the TransactionCategory that links should use.
 */
export const FD_TXN_TYPE_TO_CATEGORY_NAME: Record<Exclude<FdTxnType, "other">, string> = {
  interest:        "FD Interest",
  maturity:        "FD Maturity",
  premature_close: "FD Maturity",
  tds:             "TDS",
  transfer_in:     "Transfer",
  transfer_out:    "Transfer",
};

const NAME_TO_KIND: Record<string, "income" | "expense" | "transfer"> = {
  "FD Interest": "income",
  "FD Maturity": "income",
  "TDS":         "expense",
  "Transfer":    "transfer",
};

/**
 * Returns a Map from FdTxnType to TransactionCategory.id for a user.
 * Lookups prefer user-scoped categories, fall back to the preset (userId=null).
 * Missing categories are created for the user (idempotent: unique on name).
 *
 * `other` is intentionally not in the map — those rows are left uncategorised.
 *
 * `db` is typed as PrismaClient so this works with the real client; tests
 * pass a fake that implements `transactionCategory.findMany` + `create`.
 */
export async function resolveFdCategories(
  db: Pick<PrismaClient, "transactionCategory">,
  userId: string,
): Promise<Map<FdTxnType, string>> {
  const names = Array.from(new Set(Object.values(FD_TXN_TYPE_TO_CATEGORY_NAME)));

  const existing = await db.transactionCategory.findMany({
    where: {
      userId: { in: [userId, null] },
      name: { in: names },
    },
  });

  const byName = new Map<string, string>();
  // Prefer user-scoped over preset: walk preset rows first so user rows overwrite them.
  for (const row of existing.filter((r) => r.userId === null)) byName.set(row.name, row.id);
  for (const row of existing.filter((r) => r.userId !== null)) byName.set(row.name, row.id);

  for (const name of names) {
    if (byName.has(name)) continue;
    const created = await db.transactionCategory.create({
      data: { userId, name, kind: NAME_TO_KIND[name] },
    });
    byName.set(name, created.id);
  }

  const result = new Map<FdTxnType, string>();
  for (const [type, name] of Object.entries(FD_TXN_TYPE_TO_CATEGORY_NAME) as Array<[Exclude<FdTxnType, "other">, string]>) {
    const id = byName.get(name);
    if (id) result.set(type, id);
  }
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/fd-link/categories.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fd-link/categories.ts src/lib/fd-link/categories.test.ts
git commit -m "feat(fd-link): add category resolver for FD-linked transactions"
```

---

## Task 4: Pure link logic — `fd-link/link.ts`

A single pure function that takes one transaction, the FD candidates, and the resolved category map, and returns either a `LinkResult` or `null`.

**Files:**
- Create: `src/lib/fd-link/link.ts`, `src/lib/fd-link/link.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fd-link/link.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { linkTransactionToFd, type LinkableTxn } from "./link";
import type { MatchCandidate, FdTxnType } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "fd-a", fdNumber: "999030244019507", accountNumber: null },
  { fdId: "fd-b", fdNumber: "16984",           accountNumber: null },
];

const categories = new Map<FdTxnType, string>([
  ["interest",        "cat-interest"],
  ["maturity",        "cat-maturity"],
  ["premature_close", "cat-maturity"],
  ["tds",             "cat-tds"],
  ["transfer_in",     "cat-transfer"],
  ["transfer_out",    "cat-transfer"],
]);

function txn(description: string, direction: "debit" | "credit" = "credit"): LinkableTxn {
  return { description, direction };
}

describe("linkTransactionToFd", () => {
  it("links an interest credit with FD number match", () => {
    const r = linkTransactionToFd(txn("Int. FD-999030244019507"), fds, categories);
    expect(r).toEqual({ fdId: "fd-a", fdTxnType: "interest", categoryId: "cat-interest" });
  });

  it("links a maturity credit (suffix match)", () => {
    const r = linkTransactionToFd(txn("FD 16984 MAT CLSD"), fds, categories);
    expect(r).toEqual({ fdId: "fd-b", fdTxnType: "maturity", categoryId: "cat-maturity" });
  });

  it("returns null when no FD number present", () => {
    const r = linkTransactionToFd(txn("Salary credit"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null when FD number is present but matches no FD", () => {
    const r = linkTransactionToFd(txn("Int. FD-00000000"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null on an ambiguous suffix match", () => {
    const ambigFds: MatchCandidate[] = [
      { fdId: "x", fdNumber: "111999", accountNumber: null },
      { fdId: "y", fdNumber: "222999", accountNumber: null },
    ];
    const r = linkTransactionToFd(txn("Int. FD 999"), ambigFds, categories);
    expect(r).toBeNull();
  });

  it("does not link TDS rows (TDS descriptions don't carry an FD number)", () => {
    const r = linkTransactionToFd(txn("TDS Deducted-SB-DENGLE RAVINDRA", "debit"), fds, categories);
    // classify() returns tds + detectedFdNumber=null, so match is "none".
    expect(r).toBeNull();
  });

  it("does not link an 'other' classification even if FD number is present", () => {
    // "To RD" descriptions hit the fallthrough classifier → type "other".
    const r = linkTransactionToFd(txn("To RD 999030244019507"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null when the resolved type has no category in the map", () => {
    const partial = new Map<FdTxnType, string>([["interest", "cat-interest"]]);
    const r = linkTransactionToFd(txn("FD 16984 MAT CLSD"), fds, partial);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/fd-link/link.test.ts`
Expected: FAIL — `Cannot find module './link'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/fd-link/link.ts`:

```ts
import { classifyRow } from "./classify";
import { matchFd } from "./match";
import type { FdTxnType, MatchCandidate } from "./types";

export interface LinkableTxn {
  description: string;
  direction: "debit" | "credit";
}

export interface LinkResult {
  fdId: string;
  fdTxnType: FdTxnType;
  categoryId: string;
}

/**
 * Tries to link a single transaction to one of the user's FDs.
 *
 * Returns null when:
 *   - The description has no FD number, OR
 *   - The match is ambiguous (two FDs could plausibly own this row), OR
 *   - The classifier returns "other" (no semantic FD action detected — we
 *     refuse to link these because we wouldn't know which category to use), OR
 *   - The resolved `fdTxnType` has no category entry in `categories`.
 *
 * Note: "tds" descriptions don't contain an FD number by design, so matchFd
 * returns "none" — the function returns null without linking. That's OK:
 * TDS rows that *do* reference an FD (rare) will have FD number pulled by
 * classifyRow when the detector still finds it; when not, they stay generic.
 */
export function linkTransactionToFd(
  txn: LinkableTxn,
  fds: MatchCandidate[],
  categories: Map<FdTxnType, string>,
): LinkResult | null {
  const { type, detectedFdNumber } = classifyRow(txn.description);
  if (type === "other") return null;

  const match = matchFd(detectedFdNumber, fds);
  if (match.kind !== "matched") return null;

  const categoryId = categories.get(type);
  if (!categoryId) return null;

  return { fdId: match.fdId, fdTxnType: type, categoryId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/fd-link/link.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fd-link/link.ts src/lib/fd-link/link.test.ts
git commit -m "feat(fd-link): add linkTransactionToFd pure detector"
```

---

## Task 5: Batch orchestrators — `fd-link/link-batch.ts`

Two orchestration functions that combine the detection lib with Prisma reads/writes. Both are fire-and-forget-safe (callers catch & log, don't crash on errors).

**Files:**
- Create: `src/lib/fd-link/link-batch.ts`

- [ ] **Step 1: Implement the module**

Create `src/lib/fd-link/link-batch.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { linkTransactionToFd } from "./link";
import { resolveFdCategories } from "./categories";
import type { MatchCandidate } from "./types";

/**
 * After a bank-statement commit: scan the user's still-unlinked transactions,
 * attach fdId / fdTxnType / categoryId where we can identify the FD.
 *
 * Conservative by design:
 *   - Only touches rows where `fdId IS NULL` (won't re-link).
 *   - Only overrides category when `categorySource !== "user"`.
 *   - Skips when the user has zero active FDs (nothing to match against).
 *
 * Safe to call repeatedly — running it twice in a row is a no-op on the
 * second call because all matches from the first call now have `fdId`.
 */
export async function linkTransactionsAfterImport(userId: string): Promise<{ linked: number }> {
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId, disabled: false },
    select: { id: true, fdNumber: true, accountNumber: true },
  });
  if (fds.length === 0) return { linked: 0 };

  const candidates: MatchCandidate[] = fds.map((f) => ({
    fdId: f.id, fdNumber: f.fdNumber, accountNumber: f.accountNumber,
  }));
  const categories = await resolveFdCategories(prisma, userId);

  const rows = await prisma.transaction.findMany({
    where: { userId, fdId: null },
    select: { id: true, description: true, direction: true, categorySource: true },
  });

  let linked = 0;
  for (const row of rows) {
    const result = linkTransactionToFd(
      { description: row.description, direction: row.direction as "debit" | "credit" },
      candidates,
      categories,
    );
    if (!result) continue;

    const data: {
      fdId: string;
      fdTxnType: string;
      categoryId?: string;
      categorySource?: string;
    } = {
      fdId: result.fdId,
      fdTxnType: result.fdTxnType,
    };
    if (row.categorySource !== "user") {
      data.categoryId = result.categoryId;
      data.categorySource = "fd-link";
    }
    await prisma.transaction.update({ where: { id: row.id }, data });
    linked += 1;
  }

  return { linked };
}

/**
 * After an FD is created or its fdNumber/accountNumber changes: scan the
 * user's existing unlinked transactions for descriptions that contain
 * *this FD's* number, and link the ones that match.
 *
 * Uses a SQL `contains` filter as a cheap pre-filter so we don't load the
 * whole ledger for a single new FD. Then runs the same linkTransactionToFd
 * pass against a single-element FD list.
 */
export async function linkTransactionsForFd(userId: string, fdId: string): Promise<{ linked: number }> {
  const fd = await prisma.fixedDeposit.findUnique({
    where: { id: fdId },
    select: { id: true, userId: true, fdNumber: true, accountNumber: true, disabled: true },
  });
  if (!fd || fd.userId !== userId || fd.disabled) return { linked: 0 };

  const candidate: MatchCandidate = {
    fdId: fd.id, fdNumber: fd.fdNumber, accountNumber: fd.accountNumber,
  };

  // Collect the substrings we want to pre-filter on. Always include the
  // raw numeric parts; matchFd handles the "FD-" prefix variants.
  const needles: string[] = [];
  if (fd.fdNumber) needles.push(fd.fdNumber);
  if (fd.accountNumber) {
    needles.push(fd.accountNumber.replace(/^FD[-\s]?/i, ""));
    needles.push(fd.accountNumber);
  }
  const uniqueNeedles = Array.from(new Set(needles.filter((n) => n.length >= 3)));
  if (uniqueNeedles.length === 0) return { linked: 0 };

  const categories = await resolveFdCategories(prisma, userId);

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      fdId: null,
      OR: uniqueNeedles.map((n) => ({ description: { contains: n } })),
    },
    select: { id: true, description: true, direction: true, categorySource: true },
  });

  let linked = 0;
  for (const row of rows) {
    const result = linkTransactionToFd(
      { description: row.description, direction: row.direction as "debit" | "credit" },
      [candidate],
      categories,
    );
    if (!result) continue;

    const data: {
      fdId: string;
      fdTxnType: string;
      categoryId?: string;
      categorySource?: string;
    } = {
      fdId: result.fdId,
      fdTxnType: result.fdTxnType,
    };
    if (row.categorySource !== "user") {
      data.categoryId = result.categoryId;
      data.categorySource = "fd-link";
    }
    await prisma.transaction.update({ where: { id: row.id }, data });
    linked += 1;
  }

  return { linked };
}
```

- [ ] **Step 2: Type-check (no dedicated unit test — this file is integration glue)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: The only errors should be the pre-existing ones in files not yet touched (fd-statement dir, fd/statements UI, fd/[id]/page.tsx, fd/page.tsx). No new errors in `src/lib/fd-link/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/fd-link/link-batch.ts
git commit -m "feat(fd-link): add batch orchestrators for import and FD-create triggers"
```

---

## Task 6: Wire link pass into the bank-import commit

**Files:**
- Modify: `src/lib/bank-accounts/commit-import.ts`

- [ ] **Step 1: Add the import and the call**

At the top of `src/lib/bank-accounts/commit-import.ts`, add next to the existing `findTransferPairs` import:

```ts
import { linkTransactionsAfterImport } from "@/lib/fd-link/link-batch";
```

Then, inside `commitImport`, **after** the `for (const p of pairs) { ... }` loop that tags transfers (currently ends at line 124) and **before** `return { inserted, transfersDetected: pairs.length };`, add:

```ts
  // FD auto-link pass. Never throw outward — this mirrors the transfer
  // detector: a failure here shouldn't fail the commit, which is already
  // persisted by the time we get here.
  try {
    await linkTransactionsAfterImport(userId);
  } catch (err) {
    console.error("fd-link: linkTransactionsAfterImport failed", err);
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No new errors in `src/lib/bank-accounts/commit-import.ts`.

- [ ] **Step 3: Run the existing bank-accounts tests to make sure nothing regressed**

Run: `npx vitest run src/lib/bank-accounts/`
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bank-accounts/commit-import.ts
git commit -m "feat(bank-accounts): run FD link pass after import commit"
```

---

## Task 7: Wire link pass into FD create + update routes

**Files:**
- Modify: `src/app/api/fd/route.ts`, `src/app/api/fd/[id]/route.ts`

- [ ] **Step 1: Update the POST route (`src/app/api/fd/route.ts`)**

Add at the top with the other imports:

```ts
import { linkTransactionsForFd } from "@/lib/fd-link/link-batch";
```

Replace the two final `return NextResponse.json(...)` blocks (the 200 response after overwrite and the 201 response after create) with fire-and-forget link calls. Specifically:

For the overwrite branch (currently ends with `return NextResponse.json({ fd }, { status: 200 });`):

```ts
    try {
      await linkTransactionsForFd(userId, fd.id);
    } catch (err) {
      console.error("fd-link: linkTransactionsForFd failed", err);
    }
    return NextResponse.json({ fd }, { status: 200 });
```

For the create branch (currently ends with `return NextResponse.json({ fd }, { status: 201 });`):

```ts
  try {
    await linkTransactionsForFd(userId, fd.id);
  } catch (err) {
    console.error("fd-link: linkTransactionsForFd failed", err);
  }
  return NextResponse.json({ fd }, { status: 201 });
```

- [ ] **Step 2: Update the PATCH route (`src/app/api/fd/[id]/route.ts`)**

Add import at the top:

```ts
import { linkTransactionsForFd } from "@/lib/fd-link/link-batch";
```

Replace the `const fd = await prisma.fixedDeposit.update(...)` + `return NextResponse.json({ fd });` at the end of the `PATCH` handler with:

```ts
  const fd = await prisma.fixedDeposit.update({
    where: { id },
    data: {
      ...body,
      principal: body.principal ? Number(body.principal) : undefined,
      interestRate: body.interestRate ? Number(body.interestRate) : undefined,
      tenureMonths: body.tenureMonths !== undefined ? Number(body.tenureMonths) : undefined,
      tenureDays: body.tenureDays !== undefined ? Number(body.tenureDays) : undefined,
      tenureText: body.tenureText !== undefined ? (typeof body.tenureText === "string" && body.tenureText.trim() ? body.tenureText.trim().slice(0, 100) : null) : undefined,
      maturityAmount: body.maturityAmount ? Number(body.maturityAmount) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      maturityDate: body.maturityDate ? new Date(body.maturityDate) : undefined,
    },
  });

  // Re-link only when identifying fields changed — otherwise (e.g. just
  // toggling `disabled` or editing notes) the existing links stay correct.
  const identityChanged =
    (body.fdNumber !== undefined && body.fdNumber !== existing.fdNumber) ||
    (body.accountNumber !== undefined && body.accountNumber !== existing.accountNumber);
  if (identityChanged) {
    try {
      await linkTransactionsForFd(userId, fd.id);
    } catch (err) {
      console.error("fd-link: linkTransactionsForFd failed", err);
    }
  }

  return NextResponse.json({ fd });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No new errors in the two edited files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fd/route.ts src/app/api/fd/[id]/route.ts
git commit -m "feat(fd): run FD link pass after create/update"
```

---

## Task 8: Move `FdTxnSection` component into `fd/` and refit its types

**Files:**
- Create: `src/app/dashboard/fd/fd-txn-section.tsx`
- Modify: `src/app/dashboard/fd/fd-detail-content.tsx`

- [ ] **Step 1: Create the new component file**

Create `src/app/dashboard/fd/fd-txn-section.tsx` with the content below. Compared to the old `statements/fd-txn-section.tsx`, this version:
1. Drops the `statementId` field from `FdTxnRow` (no longer exists).
2. Replaces the "View source statement" link with a link to the bank-account list filtered by the txn ID.

```tsx
"use client";
import Link from "next/link";
import { ExternalLink, TrendingUp, CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, Minus, Circle } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

export interface FdTxnRow {
  id: string;
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: string;
  accountLabel: string;
}

type TypeMeta = { label: string; icon: typeof TrendingUp; tone: string };

const TYPE_META: Record<string, TypeMeta> = {
  interest:        { label: "Interest",         icon: TrendingUp,   tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  maturity:        { label: "Maturity",         icon: CheckCircle2, tone: "bg-[#0e2236] text-[#5ba8ff] border-[#173152]" },
  premature_close: { label: "Premature Close",  icon: XCircle,      tone: "bg-[#2a1f0d] text-[#f5a524] border-[#3a2d0f]" },
  transfer_in:     { label: "Transfer In",      icon: ArrowDownLeft,tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  transfer_out:    { label: "Transfer Out",     icon: ArrowUpRight, tone: "bg-[#2a1218] text-[#ff385c] border-[#3a1a22]" },
  tds:             { label: "TDS",              icon: Minus,        tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  other:           { label: "Other",            icon: Circle,       tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
};

export function FdTxnSection({ rows }: { rows: FdTxnRow[] }) {
  if (rows.length === 0) return null;

  const totalInterest = rows.filter((r) => r.type === "interest").reduce((a, r) => a + r.credit, 0);
  const totalTds = rows.filter((r) => r.type === "tds").reduce((a, r) => a + r.debit, 0);

  return (
    <div className="ab-card p-6">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Interest &amp; Transactions</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-1">
            {rows.length} {rows.length === 1 ? "transaction" : "transactions"} linked from your bank statements
          </p>
        </div>
        {(totalInterest > 0 || totalTds > 0) && (
          <div className="flex items-center gap-5 text-[12px]">
            {totalInterest > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#a0a0a5]">Interest received</span>
                <span className="mono font-semibold text-[#5ee0a4]">{formatINR(totalInterest)}</span>
              </div>
            )}
            {totalTds > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#a0a0a5]">TDS</span>
                <span className="mono font-semibold text-[#ededed]">{formatINR(totalTds)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sm:hidden -mx-6 divide-y divide-[#222226]">
        {rows.map((r) => {
          const meta = TYPE_META[r.type] ?? TYPE_META.other;
          const Icon = meta.icon;
          const isCredit = r.credit > 0;
          return (
            <div key={r.id} className="px-6 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                    <Icon size={11} />
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[#6e6e73]">{formatDate(r.txnDate)}</span>
                  <span className="text-[11px] text-[#6e6e73]">·</span>
                  <span className="text-[11px] text-[#6e6e73] truncate">{r.accountLabel}</span>
                  <Link
                    href={`/dashboard/bank-accounts/list?q=${encodeURIComponent(r.particulars.slice(0, 20))}`}
                    className="inline-flex items-center gap-1 text-[11px] text-[#a0a0a5] hover:text-[#ff385c] transition-colors"
                    title="View in bank transactions"
                  >
                    <ExternalLink size={11} />
                  </Link>
                </div>
                <p className="text-[12px] text-[#a0a0a5] mt-1 truncate" title={r.particulars}>{r.particulars}</p>
              </div>
              <span className={`mono text-[14px] font-semibold whitespace-nowrap shrink-0 ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73]">
              <th className="text-left font-medium px-6 pb-3">Date</th>
              <th className="text-left font-medium px-3 pb-3">Type</th>
              <th className="text-left font-medium px-3 pb-3">Account</th>
              <th className="text-left font-medium px-3 pb-3">Particulars</th>
              <th className="text-right font-medium px-3 pb-3">Amount</th>
              <th className="text-right font-medium px-6 pb-3 w-14 sm:w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = TYPE_META[r.type] ?? TYPE_META.other;
              const Icon = meta.icon;
              const isCredit = r.credit > 0;
              return (
                <tr key={r.id} className="border-t border-[#222226] hover:bg-[#17171a] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-[#ededed]">{formatDate(r.txnDate)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                      <Icon size={11} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#a0a0a5] whitespace-nowrap">{r.accountLabel}</td>
                  <td className="px-3 py-3 text-[#a0a0a5] max-w-[160px] sm:max-w-md truncate" title={r.particulars}>{r.particulars}</td>
                  <td className={`px-3 py-3 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                    {isCredit ? "+" : "−"}{formatINR(isCredit ? r.credit : r.debit)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/dashboard/bank-accounts/list?q=${encodeURIComponent(r.particulars.slice(0, 20))}`}
                      className="inline-flex items-center gap-1 text-[12px] text-[#a0a0a5] hover:text-[#ff385c] transition-colors"
                      title="View in bank transactions"
                    >
                      <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the import in `fd-detail-content.tsx`**

In `src/app/dashboard/fd/fd-detail-content.tsx`, line 7 currently reads:

```ts
import { FdTxnSection, type FdTxnRow } from "./statements/fd-txn-section";
```

Change to:

```ts
import { FdTxnSection, type FdTxnRow } from "./fd-txn-section";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `fd-detail-content.tsx` now resolves the import, but callers (`fd/page.tsx`, `fd/[id]/page.tsx`) still fail — they still build `statementId`, which the new `FdTxnRow` doesn't have. That's fixed in Task 9.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/fd-txn-section.tsx src/app/dashboard/fd/fd-detail-content.tsx
git commit -m "refactor(fd): move FdTxnSection into fd/ and switch to bank-txn source"
```

---

## Task 9: Rewire FD pages to load linked transactions from `Transaction`

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx`, `src/app/dashboard/fd/[id]/page.tsx`

- [ ] **Step 1: Rewrite `src/app/dashboard/fd/page.tsx`**

Replace the file with:

```tsx
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  const fdIds = fds.map((f) => f.id);
  const allTxns =
    fdIds.length === 0
      ? []
      : await prisma.transaction.findMany({
          where: { fdId: { in: fdIds } },
          orderBy: { txnDate: "desc" },
          select: {
            id: true,
            fdId: true,
            txnDate: true,
            description: true,
            amount: true,
            direction: true,
            fdTxnType: true,
            account: { select: { label: true } },
          },
        });

  const txnsByFd = new Map<
    string,
    Array<{
      id: string;
      txnDate: string;
      particulars: string;
      debit: number;
      credit: number;
      type: string;
      accountLabel: string;
    }>
  >();
  for (const t of allTxns) {
    if (!t.fdId) continue;
    const isCredit = t.direction === "credit";
    const row = {
      id: t.id,
      txnDate: t.txnDate.toISOString(),
      particulars: t.description,
      debit: isCredit ? 0 : t.amount,
      credit: isCredit ? t.amount : 0,
      type: t.fdTxnType ?? "other",
      accountLabel: t.account.label,
    };
    const arr = txnsByFd.get(t.fdId) ?? [];
    arr.push(row);
    txnsByFd.set(t.fdId, arr);
  }

  const fdsWithTxns = fds.map((f) => ({ ...f, txns: txnsByFd.get(f.id) ?? [] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track and analyse your fixed deposit investments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link
            href="/dashboard/fd/bulk"
            className="ab-btn ab-btn-ghost relative flex-1 sm:flex-none justify-center"
            style={{ borderColor: "#ff385c", border: "1px solid #ff385c", color: "#ff385c" }}
          >
            <Upload size={15} />
            Bulk Upload
            <span
              className="ab-chip ab-chip-accent"
              style={{ fontSize: "10px", padding: "2px 6px", marginLeft: "4px" }}
            >
              New
            </span>
          </Link>
          <Link
            href="/dashboard/fd/new"
            className="ab-btn ab-btn-accent w-full sm:w-auto justify-center"
          >
            <Plus size={15} />
            Add FD
          </Link>
        </div>
      </div>

      <FDList fds={fdsWithTxns} />
    </div>
  );
}
```

(The `FileText` import and the `Statements` CTA are gone; `FileText` is no longer referenced.)

- [ ] **Step 2: Rewrite the txn fetch block in `src/app/dashboard/fd/[id]/page.tsx`**

Replace the block spanning the current lines **32–48** (the `statementTxns` fetch + `serializedTxns` map) with:

```ts
  const linkedTxns = await prisma.transaction.findMany({
    where: { fdId: fd.id },
    orderBy: { txnDate: "desc" },
    select: {
      id: true,
      txnDate: true,
      description: true,
      amount: true,
      direction: true,
      fdTxnType: true,
      account: { select: { label: true } },
    },
  });
  const serializedTxns = linkedTxns.map((t) => {
    const isCredit = t.direction === "credit";
    return {
      id: t.id,
      txnDate: t.txnDate.toISOString(),
      particulars: t.description,
      debit: isCredit ? 0 : t.amount,
      credit: isCredit ? t.amount : 0,
      type: t.fdTxnType ?? "other",
      accountLabel: t.account.label,
    };
  });
```

No other changes needed in that file — the `<FDDetailContent fd={{ ...fd, txns: serializedTxns }} />` call already works because `FdTxnRow` is now shaped to match.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: The `fd/page.tsx`, `fd/[id]/page.tsx`, and `fd-detail-content.tsx` chain compiles. The only remaining compile errors should be in `dashboard/fd/statements/*` and `api/fd/statements/*` (handled in Task 11) and `src/lib/fd-statement/*` (handled in Task 11).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/page.tsx src/app/dashboard/fd/[id]/page.tsx
git commit -m "feat(fd): source FD detail transactions from linked bank-account rows"
```

---

## Task 10: Bank transactions list — include FD, render pill

**Files:**
- Modify: `src/app/api/bank-accounts/transactions/route.ts`, `src/app/dashboard/bank-accounts/list/transactions-table.tsx`

- [ ] **Step 1: Update the transactions API to include the FD**

In `src/app/api/bank-accounts/transactions/route.ts`, change the `include` on the `findMany` (currently `include: { category: true, account: true },` around line 49) to:

```ts
      include: {
        category: true,
        account: true,
        fd: { select: { id: true, bankName: true, fdNumber: true, accountNumber: true } },
      },
```

- [ ] **Step 2: Extend the `Row` type in `transactions-table.tsx`**

In `src/app/dashboard/bank-accounts/list/transactions-table.tsx`, update the `Row` interface (lines 22–33) to include:

```ts
interface Row {
  id: string;
  txnDate: string;
  description: string;
  prettyDescription: string | null;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; label: string };
  notes: string | null;
  fdId: string | null;
  fd: { id: string; bankName: string; fdNumber: string | null; accountNumber: string | null } | null;
}
```

- [ ] **Step 3: Add the `Link2` icon import (for the pill)**

Near the top of the file, where `lucide-react` is imported, add `Link2` to the import list:

```ts
import {
  ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, ArrowUpDown,
  Calendar, ChevronLeft, ChevronRight, Link2, Pencil, Search,
  SlidersHorizontal, X,
} from "lucide-react";
```

- [ ] **Step 4: Render the FD pill next to the description**

Find the cell that renders the description (currently lines 441–458, the `<td>` that contains `{displayLabel}` inside a flex row). Just after the `{pretty.counterBank && ...}` line at the end of that flex div, add the pill:

```tsx
                      {r.fd && (
                        <Link
                          href={`/dashboard/fd/${r.fd.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#2a1218] text-[#ff385c] border-[#3a1a22] hover:bg-[#3a1a22] transition-colors"
                          title={`Linked to FD at ${r.fd.bankName}`}
                        >
                          <Link2 size={10} />
                          FD · {r.fd.bankName.split(" ")[0]}
                          {r.fd.fdNumber ? ` · ${r.fd.fdNumber}` : r.fd.accountNumber ? ` · ${r.fd.accountNumber.slice(-4)}` : ""}
                        </Link>
                      )}
```

(Also add the `import Link from "next/link";` at the top if it's not already imported — this file doesn't currently use `next/link`.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No new errors in the bank-accounts files.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bank-accounts/transactions/route.ts src/app/dashboard/bank-accounts/list/transactions-table.tsx
git commit -m "feat(bank-accounts): show FD pill on linked transactions"
```

---

## Task 11: Delete obsolete FD-statement pages, API routes, and lib

**Files:**
- Delete: `src/app/dashboard/fd/statements/` (entire directory)
- Delete: `src/app/api/fd/statements/` (entire directory)
- Delete: `src/lib/fd-statement/` (entire directory)

- [ ] **Step 1: Remove the FD-statement UI subtree**

Run: `rm -rf src/app/dashboard/fd/statements`

- [ ] **Step 2: Remove the FD-statement API subtree**

Run: `rm -rf src/app/api/fd/statements`

- [ ] **Step 3: Remove the old detection library**

Run: `rm -rf src/lib/fd-statement`

- [ ] **Step 4: Grep for stragglers**

Run: `rg "fd-statement|fd/statements|fDStatement|FDStatement|FDStatementTxn|statementTxns" src`
Expected: Zero hits. If anything matches, edit or delete it. (In particular, verify that `src/app/dashboard/fd/page.tsx` and `src/app/dashboard/fd/[id]/page.tsx` no longer reference `fDStatementTxn` or `FileText`.)

- [ ] **Step 5: Full type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: Clean — no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass. (Old `fd-statement/*.test.ts` files are gone; the new `fd-link/*.test.ts` replace them.)

- [ ] **Step 7: Smoke check the dev server**

Run: `npm run dev` in the background, then visit:
- `/dashboard/fd` — FD list renders, no "Statements" button, inline txn section appears for any FD with linked transactions.
- `/dashboard/fd/<some-id>` — detail page renders; `Interest & Transactions` section shows linked bank transactions (or is hidden if none).
- `/dashboard/bank-accounts/list` — any existing FD-linked transactions show the FD pill.
- `/dashboard/fd/statements` — 404.
- `/api/fd/statements` — 404.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove standalone FD statement import system"
```

---

## Self-review — run before handing off

Before offering the execution choice, run through this checklist with fresh eyes:

**1. Spec coverage** — every section of the design spec has a task that implements it:
- Schema changes → Task 1 ✓
- Detection & linking logic (fd-link module, two triggers) → Tasks 2–4 (module), Tasks 5, 6, 7 (orchestration + wiring) ✓
- Auto-categorization (four seeded categories, precedence rules) → Task 3 (resolver), Tasks 5–7 (use) ✓
- UI — delete FD-statements subtree → Task 11 ✓
- UI — FD detail page (transactions source change) → Tasks 8–9 ✓
- UI — bank transactions list FD pill → Task 10 ✓
- Error handling (fire-and-forget) → implemented in Tasks 6–7 ✓
- Testing (unit + regression) → classify + match + categories + link tests in Tasks 2–4 ✓

**2. Type consistency** — `FdTxnType` is defined once in `fd-link/types.ts` and imported everywhere. `MatchCandidate` is the trimmed shape (no `label`, no `maturityDate`). `LinkableTxn` matches the fields all callers have available (`description` + `direction`). `FdTxnRow` is defined in `fd-txn-section.tsx` and both FD page callers (list + detail) build rows matching that shape.

**3. Placeholder scan** — no "TBD", "TODO", "similar to", "add validation", or missing code blocks. Every step gives an exact command and exact code.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-link-fd-to-bank-statements.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
