# Tally ERP 9 XML Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated two-step export page that generates a Tally ERP 9-compatible XML voucher file from filtered bank transactions.

**Architecture:** Pure XML-builder lib function (`tally-xml.ts`) tested in isolation; two new API routes (categories lookup GET + XML export POST) built on top of existing Prisma filter patterns; a server-rendered page that pre-fetches accounts and passes them to a client-side two-step wizard component.

**Tech Stack:** Next.js 16 App Router, Prisma + libSQL, Vitest, Tailwind CSS, Lucide icons, custom `DatePicker` from `@/components/ui/date-picker`, `ab-btn` CSS utility classes.

**Spec:** `docs/superpowers/specs/2026-04-23-tally-export-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/bank-accounts/tally-types.ts` | Shared TypeScript types (VoucherType, LedgerConfig, TxnForExport) |
| Create | `src/lib/bank-accounts/tally-xml.ts` | Pure function: builds Tally ERP 9 XML string from transactions + ledger config |
| Create | `src/lib/bank-accounts/tally-xml.test.ts` | Vitest unit tests for `buildTallyXml` |
| Create | `src/app/api/bank-accounts/export/tally/categories/route.ts` | GET — returns distinct categories in filtered transactions |
| Create | `src/app/api/bank-accounts/export/tally/categories/route.test.ts` | Vitest tests for categories endpoint |
| Create | `src/app/api/bank-accounts/export/tally/route.ts` | POST — generates and streams XML file |
| Create | `src/app/api/bank-accounts/export/tally/route.test.ts` | Vitest tests for export endpoint |
| Create | `src/app/dashboard/bank-accounts/export/tally/page.tsx` | Server component: auth guard + pre-fetch accounts |
| Create | `src/app/dashboard/bank-accounts/export/tally/tally-export-client.tsx` | Client component: two-step wizard UI |
| Modify | `src/app/dashboard/bank-accounts/page.tsx` | Add "Tally Export" nav card |

---

## Task 1: Shared Types

**Files:**
- Create: `src/lib/bank-accounts/tally-types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/lib/bank-accounts/tally-types.ts
export type VoucherType = "Payment" | "Receipt" | "Contra" | "Journal";

export interface LedgerConfig {
  bankLedgerName: string;
  categoryMappings: {
    categoryId: string | null; // null = uncategorized
    tallyLedgerName: string;
    voucherType: VoucherType;
  }[];
}

export interface TxnForExport {
  id: string;
  txnDate: Date;
  description: string;
  prettyDescription: string | null;
  amount: number;
  direction: string; // "debit" | "credit"
  categoryId: string | null;
}

export interface CategoryForExport {
  categoryId: string;
  categoryName: string;
  kind: string; // "expense" | "income" | "transfer"
}

export interface ExportFilters {
  from?: string;
  to?: string;
  accountId?: string;
  categoryIds?: string[];
  direction?: string;
  q?: string;
  minAmount?: string;
  maxAmount?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bank-accounts/tally-types.ts
git commit -m "feat(tally-export): add shared types for Tally XML export"
```

---

## Task 2: XML Generator (TDD)

**Files:**
- Create: `src/lib/bank-accounts/tally-xml.ts`
- Create: `src/lib/bank-accounts/tally-xml.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/bank-accounts/tally-xml.test.ts
import { describe, it, expect } from "vitest";
import { buildTallyXml } from "./tally-xml";
import type { LedgerConfig, TxnForExport } from "./tally-types";

const config: LedgerConfig = {
  bankLedgerName: "HDFC Savings",
  categoryMappings: [
    { categoryId: "cat1", tallyLedgerName: "Food Expenses", voucherType: "Payment" },
    { categoryId: null, tallyLedgerName: "Sundry Expenses", voucherType: "Payment" },
  ],
};

const debitTxn: TxnForExport = {
  id: "txn1",
  txnDate: new Date("2024-01-15T00:00:00.000Z"),
  description: "SWIGGY UPI",
  prettyDescription: "Swiggy Order",
  amount: 500,
  direction: "debit",
  categoryId: "cat1",
};

const creditTxn: TxnForExport = {
  id: "txn2",
  txnDate: new Date("2024-01-20T00:00:00.000Z"),
  description: "SALARY CREDIT",
  prettyDescription: null,
  amount: 50000,
  direction: "credit",
  categoryId: null,
};

describe("buildTallyXml", () => {
  it("wraps output in a valid Tally ERP 9 envelope", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
    expect(xml).toContain("<REPORTNAME>Vouchers</REPORTNAME>");
    expect(xml).toContain('<TALLYMESSAGE xmlns:UDF="TallyUDF">');
  });

  it("sets REMOTEID to the transaction id", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain('REMOTEID="txn1"');
  });

  it("formats DATE as YYYYMMDD with no separators", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<DATE>20240115</DATE>");
  });

  it("uses prettyDescription as NARRATION when available", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<NARRATION>Swiggy Order</NARRATION>");
  });

  it("falls back to description when prettyDescription is null", () => {
    const xml = buildTallyXml([creditTxn], config);
    expect(xml).toContain("<NARRATION>SALARY CREDIT</NARRATION>");
  });

  it("sets correct amounts and ISDEEMEDPOSITIVE for a debit transaction", () => {
    const xml = buildTallyXml([debitTxn], config);
    // Category leg: deemed=No, amount=-500.00
    // Bank leg: deemed=Yes, amount=500.00
    const catIdx = xml.indexOf("<LEDGERNAME>Food Expenses</LEDGERNAME>");
    const bankIdx = xml.indexOf("<LEDGERNAME>HDFC Savings</LEDGERNAME>");
    expect(catIdx).toBeGreaterThan(-1);
    expect(bankIdx).toBeGreaterThan(-1);
    // Category block comes first
    expect(catIdx).toBeLessThan(bankIdx);
    // Check amounts in order
    const catBlock = xml.slice(catIdx, bankIdx);
    expect(catBlock).toContain("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>");
    expect(catBlock).toContain("<AMOUNT>-500.00</AMOUNT>");
    const bankBlock = xml.slice(bankIdx);
    expect(bankBlock).toContain("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>");
    expect(bankBlock).toContain("<AMOUNT>500.00</AMOUNT>");
  });

  it("sets correct amounts and ISDEEMEDPOSITIVE for a credit transaction", () => {
    const xml = buildTallyXml([creditTxn], config);
    const catIdx = xml.indexOf("<LEDGERNAME>Sundry Expenses</LEDGERNAME>");
    const bankIdx = xml.indexOf("<LEDGERNAME>HDFC Savings</LEDGERNAME>");
    const catBlock = xml.slice(catIdx, bankIdx);
    expect(catBlock).toContain("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>");
    expect(catBlock).toContain("<AMOUNT>50000.00</AMOUNT>");
    const bankBlock = xml.slice(bankIdx);
    expect(bankBlock).toContain("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>");
    expect(bankBlock).toContain("<AMOUNT>-50000.00</AMOUNT>");
  });

  it("maps uncategorized transactions (categoryId: null) to the null mapping", () => {
    const xml = buildTallyXml([creditTxn], config);
    expect(xml).toContain("<LEDGERNAME>Sundry Expenses</LEDGERNAME>");
  });

  it("escapes XML special characters in ledger names and narration", () => {
    const txn: TxnForExport = { ...debitTxn, prettyDescription: "AT&T <Payment>" };
    const cfg: LedgerConfig = {
      ...config,
      categoryMappings: [{ categoryId: "cat1", tallyLedgerName: "Food & Dining", voucherType: "Payment" }],
    };
    const xml = buildTallyXml([txn], cfg);
    expect(xml).toContain("AT&amp;T &lt;Payment&gt;");
    expect(xml).toContain("Food &amp; Dining");
  });

  it("throws when a transaction has no ledger mapping", () => {
    const unmapped: TxnForExport = { ...debitTxn, categoryId: "unknown-id" };
    expect(() => buildTallyXml([unmapped], config)).toThrow(
      "No ledger mapping for categoryId: unknown-id"
    );
  });

  it("generates one VOUCHER element per transaction", () => {
    const xml = buildTallyXml([debitTxn, creditTxn], config);
    const count = (xml.match(/<VOUCHER /g) ?? []).length;
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/bank-accounts/tally-xml.test.ts
```

Expected: FAIL — `Cannot find module './tally-xml'`

- [ ] **Step 3: Implement the XML generator**

```ts
// src/lib/bank-accounts/tally-xml.ts
import type { LedgerConfig, TxnForExport } from "./tally-types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildTallyXml(txns: TxnForExport[], config: LedgerConfig): string {
  const mappingIndex = new Map(
    config.categoryMappings.map((m) => [m.categoryId ?? "__uncategorized__", m])
  );

  const vouchers = txns
    .map((txn) => {
      const key = txn.categoryId ?? "__uncategorized__";
      const mapping = mappingIndex.get(key);
      if (!mapping) throw new Error(`No ledger mapping for categoryId: ${txn.categoryId}`);

      const narration = escapeXml(txn.prettyDescription ?? txn.description);
      const bankLedger = escapeXml(config.bankLedgerName);
      const catLedger = escapeXml(mapping.tallyLedgerName);
      const date = formatDate(txn.txnDate);
      const amt = txn.amount.toFixed(2);
      const isDebit = txn.direction === "debit";

      const catDeemed = isDebit ? "No" : "Yes";
      const catAmount = isDebit ? `-${amt}` : amt;
      const bankDeemed = isDebit ? "Yes" : "No";
      const bankAmount = isDebit ? amt : `-${amt}`;

      return `        <VOUCHER REMOTEID="${txn.id}" VCHTYPE="${mapping.voucherType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${date}</DATE>
          <NARRATION>${narration}</NARRATION>
          <VOUCHERTYPENAME>${mapping.voucherType}</VOUCHERTYPENAME>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${catLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${catDeemed}</ISDEEMEDPOSITIVE>
            <AMOUNT>${catAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${bankLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${bankDeemed}</ISDEEMEDPOSITIVE>
            <AMOUNT>${bankAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
${vouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/bank-accounts/tally-xml.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank-accounts/tally-xml.ts src/lib/bank-accounts/tally-xml.test.ts
git commit -m "feat(tally-export): add XML generator with full test coverage"
```

---

## Task 3: Categories API Endpoint (TDD)

**Files:**
- Create: `src/app/api/bank-accounts/export/tally/categories/route.ts`
- Create: `src/app/api/bank-accounts/export/tally/categories/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/bank-accounts/export/tally/categories/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

import { GET } from "./route";
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function makeReq(qs = "") {
  return new NextRequest(
    `http://localhost/api/bank-accounts/export/tally/categories${qs ? `?${qs}` : ""}`
  );
}

describe("GET /api/bank-accounts/export/tally/categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns categories and hasUncategorized=false when all are categorized", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { categoryId: "cat1", category: { id: "cat1", name: "Food", kind: "expense" } },
      { categoryId: "cat2", category: { id: "cat2", name: "Salary", kind: "income" } },
    ] as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasUncategorized).toBe(false);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0]).toEqual({ categoryId: "cat1", categoryName: "Food", kind: "expense" });
  });

  it("returns hasUncategorized=true when some transactions have no category", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { categoryId: null, category: null },
      { categoryId: "cat1", category: { id: "cat1", name: "Food", kind: "expense" } },
    ] as never);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.hasUncategorized).toBe(true);
    expect(body.categories).toHaveLength(1);
  });

  it("passes accountId filter to Prisma", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    await GET(makeReq("accountId=acc123"));
    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc123" }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/app/api/bank-accounts/export/tally/categories/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the categories route**

```ts
// src/app/api/bank-accounts/export/tally/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

function buildWhere(url: URL, userId: string): Record<string, unknown> {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const accountId = url.searchParams.get("accountId");
  const categoryIds = url.searchParams.getAll("categoryId");
  const direction = url.searchParams.get("direction");
  const q = url.searchParams.get("q");
  const minAmount = url.searchParams.get("minAmount");
  const maxAmount = url.searchParams.get("maxAmount");

  const where: Record<string, unknown> = { userId };
  if (from || to) {
    where.txnDate = {} as Record<string, Date>;
    if (from) (where.txnDate as Record<string, Date>).gte = new Date(from);
    if (to) (where.txnDate as Record<string, Date>).lte = new Date(to);
  }
  if (accountId) where.accountId = accountId;
  if (categoryIds.length > 0) where.categoryId = { in: categoryIds };
  if (direction) where.direction = direction;
  if (q) where.description = { contains: q };
  if (minAmount || maxAmount) {
    where.amount = {} as Record<string, number>;
    if (minAmount) (where.amount as Record<string, number>).gte = Number(minAmount);
    if (maxAmount) (where.amount as Record<string, number>).lte = Number(maxAmount);
  }
  return where;
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = buildWhere(new URL(req.url), userId);

  const rows = await prisma.transaction.findMany({
    where,
    select: { categoryId: true, category: { select: { id: true, name: true, kind: true } } },
    distinct: ["categoryId"],
  });

  const hasUncategorized = rows.some((r) => r.categoryId === null);
  const categories = rows
    .filter((r) => r.categoryId !== null && r.category !== null)
    .map((r) => ({ categoryId: r.categoryId!, categoryName: r.category!.name, kind: r.category!.kind }));

  return NextResponse.json({ categories, hasUncategorized });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/bank-accounts/export/tally/categories/route.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bank-accounts/export/tally/categories/route.ts \
        src/app/api/bank-accounts/export/tally/categories/route.test.ts
git commit -m "feat(tally-export): add categories lookup API endpoint"
```

---

## Task 4: Export API Endpoint (TDD)

**Files:**
- Create: `src/app/api/bank-accounts/export/tally/route.ts`
- Create: `src/app/api/bank-accounts/export/tally/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/bank-accounts/export/tally/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));
vi.mock("@/lib/bank-accounts/tally-xml", () => ({
  buildTallyXml: vi.fn().mockReturnValue("<ENVELOPE/>"),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

import { POST } from "./route";
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildTallyXml } from "@/lib/bank-accounts/tally-xml";

const validConfig = {
  bankLedgerName: "HDFC Savings",
  categoryMappings: [{ categoryId: null, tallyLedgerName: "Sundry", voucherType: "Payment" }],
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/bank-accounts/export/tally", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockTxn = {
  id: "t1",
  txnDate: new Date("2024-01-15T00:00:00.000Z"),
  description: "SWIGGY",
  prettyDescription: null,
  amount: 500,
  direction: "debit",
  categoryId: null,
};

describe("POST /api/bank-accounts/export/tally", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when bankLedgerName is empty", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    const res = await POST(
      makeReq({ filters: {}, ledgerConfig: { bankLedgerName: "  ", categoryMappings: [] } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Bank ledger name is required");
  });

  it("returns 400 when no transactions match the filters", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No transactions");
  });

  it("returns 400 when a transaction category has no mapping", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { ...mockTxn, categoryId: "unmapped-cat" },
    ] as never);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing ledger mapping");
  });

  it("returns XML file with correct headers when request is valid", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTxn] as never);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment.*\.xml/);
  });

  it("calls buildTallyXml with the fetched transactions and ledger config", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTxn] as never);
    await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(buildTallyXml).toHaveBeenCalledWith([mockTxn], validConfig);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/app/api/bank-accounts/export/tally/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the export route**

```ts
// src/app/api/bank-accounts/export/tally/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { buildTallyXml } from "@/lib/bank-accounts/tally-xml";
import type { LedgerConfig, ExportFilters } from "@/lib/bank-accounts/tally-types";

function buildWhere(filters: ExportFilters, userId: string): Record<string, unknown> {
  const where: Record<string, unknown> = { userId };
  if (filters.from || filters.to) {
    where.txnDate = {} as Record<string, Date>;
    if (filters.from) (where.txnDate as Record<string, Date>).gte = new Date(filters.from);
    if (filters.to) (where.txnDate as Record<string, Date>).lte = new Date(filters.to);
  }
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryIds?.length) where.categoryId = { in: filters.categoryIds };
  if (filters.direction) where.direction = filters.direction;
  if (filters.q) where.description = { contains: filters.q };
  if (filters.minAmount || filters.maxAmount) {
    where.amount = {} as Record<string, number>;
    if (filters.minAmount) (where.amount as Record<string, number>).gte = Number(filters.minAmount);
    if (filters.maxAmount) (where.amount as Record<string, number>).lte = Number(filters.maxAmount);
  }
  return where;
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { filters: ExportFilters; ledgerConfig: LedgerConfig };
  const { filters, ledgerConfig } = body;

  if (!ledgerConfig?.bankLedgerName?.trim()) {
    return NextResponse.json({ error: "Bank ledger name is required" }, { status: 400 });
  }

  const where = buildWhere(filters ?? {}, userId);
  const txns = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      txnDate: true,
      description: true,
      prettyDescription: true,
      amount: true,
      direction: true,
      categoryId: true,
    },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });

  if (txns.length === 0) {
    return NextResponse.json(
      { error: "No transactions match the selected filters" },
      { status: 400 }
    );
  }

  const mappedKeys = new Set(
    ledgerConfig.categoryMappings.map((m) => m.categoryId ?? "__uncategorized__")
  );
  const uniqueKeys = new Set(txns.map((t) => t.categoryId ?? "__uncategorized__"));
  const missing = [...uniqueKeys].filter((k) => !mappedKeys.has(k));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing ledger mapping for categories: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const xml = buildTallyXml(txns, ledgerConfig);
  const today = new Date().toISOString().split("T")[0];

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="tally-export-${today}.xml"`,
    },
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/bank-accounts/export/tally/route.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: All tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bank-accounts/export/tally/route.ts \
        src/app/api/bank-accounts/export/tally/route.test.ts
git commit -m "feat(tally-export): add XML export API endpoint"
```

---

## Task 5: Server Page + Client Wizard

**Files:**
- Create: `src/app/dashboard/bank-accounts/export/tally/page.tsx`
- Create: `src/app/dashboard/bank-accounts/export/tally/tally-export-client.tsx`

- [ ] **Step 1: Create the server page**

```tsx
// src/app/dashboard/bank-accounts/export/tally/page.tsx
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { TallyExportClient } from "./tally-export-client";

export default async function TallyExportPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { userId, disabled: false },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId }, { userId: null }], disabled: false },
      select: { id: true, name: true, kind: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <TallyExportClient accounts={accounts} categories={categories} />;
}
```

- [ ] **Step 2: Create the client wizard component**

```tsx
// src/app/dashboard/bank-accounts/export/tally/tally-export-client.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Download, FileDown } from "lucide-react";
import type { VoucherType, ExportFilters, CategoryForExport } from "@/lib/bank-accounts/tally-types";

interface MappingRow extends CategoryForExport {
  tallyLedgerName: string;
  voucherType: VoucherType;
}

const UNCATEGORIZED_ROW: CategoryForExport = {
  categoryId: "__uncategorized__",
  categoryName: "Uncategorized",
  kind: "—",
};

const KIND_LABELS: Record<string, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  "—": "—",
};

const VOUCHER_TYPES: VoucherType[] = ["Payment", "Receipt", "Contra", "Journal"];

export function TallyExportClient({
  accounts,
  categories,
}: {
  accounts: { id: string; label: string }[];
  categories: { id: string; name: string; kind: string }[];
}) {
  const [step, setStep] = useState<"filters" | "ledger-mapping">("filters");
  const [filters, setFilters] = useState<ExportFilters>({
    from: "",
    to: "",
    accountId: "",
    categoryIds: [],
    direction: "",
    q: "",
    minAmount: "",
    maxAmount: "",
  });
  const [txnCount, setTxnCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [bankLedgerName, setBankLedgerName] = useState("");
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch count whenever filters change
  const fetchCount = useCallback(async () => {
    setCountLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.accountId) params.set("accountId", filters.accountId);
    (filters.categoryIds ?? []).forEach((id) => params.append("categoryId", id));
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.q) params.set("q", filters.q);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
    params.set("pageSize", "1");

    try {
      const r = await fetch(`/api/bank-accounts/transactions?${params}`);
      if (r.ok) {
        const data = await r.json() as { total: number };
        setTxnCount(data.total);
      }
    } finally {
      setCountLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 400);
    return () => clearTimeout(t);
  }, [fetchCount]);

  async function handleNext() {
    if (!txnCount) return;
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.accountId) params.set("accountId", filters.accountId);
    (filters.categoryIds ?? []).forEach((id) => params.append("categoryId", id));
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.q) params.set("q", filters.q);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);

    const r = await fetch(`/api/bank-accounts/export/tally/categories?${params}`);
    if (!r.ok) { setError("Failed to load categories"); return; }
    const data = await r.json() as { categories: CategoryForExport[]; hasUncategorized: boolean };

    const rows: MappingRow[] = [
      ...data.categories.map((c) => ({ ...c, tallyLedgerName: "", voucherType: "Payment" as VoucherType })),
      ...(data.hasUncategorized ? [{ ...UNCATEGORIZED_ROW, tallyLedgerName: "", voucherType: "Payment" as VoucherType }] : []),
    ];
    setMappings(rows);
    // Pre-fill bank ledger name from selected account label
    const selectedAccount = accounts.find((a) => a.id === filters.accountId);
    setBankLedgerName(selectedAccount?.label ?? "");
    setError(null);
    setStep("ledger-mapping");
  }

  function handleBack() {
    if (mappings.some((m) => m.tallyLedgerName)) {
      if (!confirm("Going back will reset your ledger mapping. Continue?")) return;
    }
    setMappings([]);
    setStep("filters");
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const ledgerConfig = {
        bankLedgerName,
        categoryMappings: mappings.map((m) => ({
          categoryId: m.categoryId === "__uncategorized__" ? null : m.categoryId,
          tallyLedgerName: m.tallyLedgerName,
          voucherType: m.voucherType,
        })),
      };
      const r = await fetch("/api/bank-accounts/export/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, ledgerConfig }),
      });
      if (!r.ok) {
        const err = await r.json() as { error: string };
        setError(err.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tally-export-${new Date().toISOString().split("T")[0]}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const downloadDisabled =
    !bankLedgerName.trim() || mappings.some((m) => !m.tallyLedgerName.trim()) || downloading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Export to Tally</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Generate a Tally ERP 9 XML file from your bank transactions.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {step === "filters" && (
        <div className="space-y-5">
          <div className="p-4 bg-[#1c1c20] border border-[#2a2a2e] rounded-xl space-y-4">
            <h2 className="text-[15px] font-semibold text-[#ededed]">Step 1 — Select transactions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Account */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Account</label>
                <select
                  value={filters.accountId}
                  onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                >
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              {/* Direction */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                >
                  <option value="">All</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              {/* From date */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">From</label>
                <DatePicker
                  value={filters.from ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
                  placeholder="Start date"
                />
              </div>

              {/* To date */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">To</label>
                <DatePicker
                  value={filters.to ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
                  placeholder="End date"
                />
              </div>

              {/* Min amount */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Min amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.minAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              {/* Max amount */}
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Max amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
                  placeholder="No limit"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              {/* Text search */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[12px] text-[#a0a0a5]">Description search</label>
                <input
                  type="text"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="e.g. SWIGGY"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              {/* Category multi-select */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[12px] text-[#a0a0a5]">
                  Categories{" "}
                  <span className="text-[#6e6e73]">(hold Ctrl/Cmd to select multiple)</span>
                </label>
                <select
                  multiple
                  value={filters.categoryIds ?? []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFilters((f) => ({ ...f, categoryIds: selected }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                  size={Math.min(categories.length, 6)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {(filters.categoryIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, categoryIds: [] }))}
                    className="text-[11px] text-[#6e6e73] hover:text-[#a0a0a5]"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#a0a0a5]">
              {countLoading
                ? "Counting…"
                : txnCount === null
                ? ""
                : txnCount === 0
                ? "No transactions match these filters"
                : `${txnCount.toLocaleString()} transaction${txnCount === 1 ? "" : "s"} matched`}
            </p>
            <button
              onClick={handleNext}
              disabled={!txnCount}
              className="ab-btn ab-btn-accent"
            >
              <FileDown size={15} /> Next: Configure Ledgers
            </button>
          </div>
        </div>
      )}

      {step === "ledger-mapping" && (
        <div className="space-y-5">
          <div className="p-4 bg-[#1c1c20] border border-[#2a2a2e] rounded-xl space-y-4">
            <h2 className="text-[15px] font-semibold text-[#ededed]">Step 2 — Map to Tally ledgers</h2>

            {/* Bank ledger name */}
            <div className="space-y-1">
              <label className="text-[12px] text-[#a0a0a5]">Bank ledger name in Tally</label>
              <input
                type="text"
                value={bankLedgerName}
                onChange={(e) => setBankLedgerName(e.target.value)}
                placeholder="e.g. HDFC Bank A/c"
                className="w-full sm:w-72 h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
              />
            </div>

            {/* Category mapping table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#2a2a2e]">
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium">Category</th>
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium">Kind</th>
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium w-56">Tally Ledger Name</th>
                    <th className="text-left py-2 text-[#6e6e73] font-medium">Voucher Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((row, i) => (
                    <tr key={row.categoryId} className="border-b border-[#1e1e22]">
                      <td className="py-2 pr-4 text-[#ededed]">{row.categoryName}</td>
                      <td className="py-2 pr-4 text-[#6e6e73]">{KIND_LABELS[row.kind] ?? row.kind}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={row.tallyLedgerName}
                          onChange={(e) =>
                            setMappings((ms) =>
                              ms.map((m, j) =>
                                j === i ? { ...m, tallyLedgerName: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Ledger name"
                          className="w-full h-8 px-2 rounded-md bg-[#111113] border border-[#2a2a2e] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={row.voucherType}
                          onChange={(e) =>
                            setMappings((ms) =>
                              ms.map((m, j) =>
                                j === i ? { ...m, voucherType: e.target.value as VoucherType } : m
                              )
                            )
                          }
                          className="h-8 px-2 rounded-md bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                        >
                          {VOUCHER_TYPES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleBack} className="ab-btn ab-btn-secondary">
              <ArrowLeft size={15} /> Back to Filters
            </button>
            <div className="flex items-center gap-3">
              <p className="text-[13px] text-[#a0a0a5]">
                {txnCount?.toLocaleString()} transaction{txnCount === 1 ? "" : "s"} will be exported
              </p>
              <button
                onClick={handleDownload}
                disabled={downloadDisabled}
                className="ab-btn ab-btn-accent"
              >
                <Download size={15} />
                {downloading ? "Generating…" : "Download XML"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | grep -E "tally-export|tally-types|tally-xml" | head -20
```

Expected: No errors for the new files.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/bank-accounts/export/tally/page.tsx \
        src/app/dashboard/bank-accounts/export/tally/tally-export-client.tsx
git commit -m "feat(tally-export): add two-step export page"
```

---

## Task 6: Nav Link

**Files:**
- Modify: `src/app/dashboard/bank-accounts/page.tsx`

- [ ] **Step 1: Add the import for the FileOutput icon**

In `src/app/dashboard/bank-accounts/page.tsx`, find:

```ts
import { ArrowLeftRight, Landmark, Tag, Files, Upload } from "lucide-react";
```

Replace with:

```ts
import { ArrowLeftRight, FileOutput, Landmark, Tag, Files, Upload } from "lucide-react";
```

- [ ] **Step 2: Add the Tally export nav card**

Find the nav card array:

```ts
{ href: "/dashboard/bank-accounts/imports", label: "Manage Statements", icon: <Files size={20} />, desc: "Imports history" },
```

Add after it:

```ts
{ href: "/dashboard/bank-accounts/export/tally", label: "Tally Export", icon: <FileOutput size={20} />, desc: "Export to Tally ERP 9" },
```

- [ ] **Step 3: Update the grid to accommodate 5 cards**

The grid is currently `grid-cols-2 sm:grid-cols-4`. With 5 cards, change it to wrap naturally — update to:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | grep "bank-accounts/page" | head -10
```

Expected: No errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/bank-accounts/page.tsx
git commit -m "feat(tally-export): add Tally Export nav card to bank accounts overview"
```

---

## Manual Verification Checklist

After all tasks are done, start the dev server (`npm run dev`) and verify:

1. Navigate to `/dashboard/bank-accounts` — "Tally Export" card appears in the nav grid
2. Click "Tally Export" — two-step page loads with filter form
3. Set a date range that matches some transactions — count badge updates
4. Click "Next: Configure Ledgers" — mapping table shows one row per category + uncategorized row if applicable
5. Fill in all ledger names and pick voucher types
6. Click "Download XML" — browser downloads `tally-export-YYYY-MM-DD.xml`
7. Open the XML file — verify it is valid XML with `<ENVELOPE>` root and one `<VOUCHER>` per transaction
8. Click "← Back to Filters" — confirmation dialog appears when mappings are filled in
9. Leave all ledger names empty — "Download XML" button stays disabled
10. Set filters that match 0 transactions — "Next" button is disabled
