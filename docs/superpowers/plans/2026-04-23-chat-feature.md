# Chat Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating AI chat widget that answers natural language questions about the user's financial portfolio (transactions, FDs, equity, gold) using Claude tool use, with streaming responses and source citations.

**Architecture:** A `ChatWidget` component (mounted in root layout) opens a floating panel. Queries POST to `/api/chat`, which calls Claude with 6 Prisma-backed tools. Claude calls tools to fetch data, we inject results, then stream the final answer back over SSE. Conversation history is kept in React state (client-side only, no DB persistence).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Anthropic SDK (`@anthropic-ai/sdk`), Prisma (SQLite), NextAuth, Tailwind CSS, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/chat/types.ts` | Create | Shared TypeScript types for chat |
| `src/lib/chat/system-prompt.ts` | Create | Claude system prompt string |
| `src/lib/chat/tool-definitions.ts` | Create | Anthropic-format tool schemas |
| `src/lib/chat/tool-runners.ts` | Create | Prisma query implementations per tool |
| `src/lib/chat/tool-runners.test.ts` | Create | Vitest tests for tool runners |
| `src/app/api/chat/route.ts` | Create | Streaming POST endpoint |
| `src/components/chat/ChatWidget.tsx` | Create | FAB button + open/close state |
| `src/components/chat/ChatPanel.tsx` | Create | Message list, SSE streaming, starters |
| `src/components/chat/ChatMessage.tsx` | Create | Single message + citation block |
| `src/components/chat/ChatInput.tsx` | Create | Input field + submit button |
| `src/app/layout.tsx` | Modify | Mount `<ChatWidget />` |

---

## Task 1: Shared Types

**Files:**
- Create: `src/lib/chat/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/chat/types.ts

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  citations?: Citation[];
}

export interface Citation {
  id: string;
  type: "transaction" | "fd" | "equity" | "gold";
  date?: string;
  description?: string;
  amount?: number;
  direction?: "debit" | "credit";
  label?: string;
}

export type SSEChunk =
  | { type: "text"; content: string }
  | { type: "citations"; records: Citation[] }
  | { type: "error"; message: string }
  | { type: "done" };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat/types.ts
git commit -m "feat(chat): add shared types"
```

---

## Task 2: System Prompt

**Files:**
- Create: `src/lib/chat/system-prompt.ts`

- [ ] **Step 1: Create the system prompt**

```typescript
// src/lib/chat/system-prompt.ts

export const SYSTEM_PROMPT = `You are a personal financial assistant embedded in an investment tracking app. You have tools to fetch the user's live financial data.

Rules:
- Always use tools to answer financial questions. Never guess or fabricate amounts.
- Format currency as ₹X,XX,XXX (Indian numbering system). No decimals unless relevant.
- Lead with the direct answer, then add context. Be concise.
- If no data is found, say: "I couldn't find any [transactions/FDs/etc.] matching that."
- For unspecified date ranges, default to the current year.
- Amounts in the database are in INR.
- Today's date: ${new Date().toISOString().slice(0, 10)}.`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat/system-prompt.ts
git commit -m "feat(chat): add system prompt"
```

---

## Task 3: Tool Definitions

**Files:**
- Create: `src/lib/chat/tool-definitions.ts`

- [ ] **Step 1: Create tool definitions in Anthropic format**

```typescript
// src/lib/chat/tool-definitions.ts
import type Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_transactions",
    description:
      "Search bank transactions by keyword, date range, amount, or direction. Use for questions like 'how much did I send to Amruta', 'show all Swiggy orders', 'credits in March'.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description:
            "Search term matched against transaction description (e.g. 'amruta', 'swiggy'). Case-insensitive.",
        },
        fromDate: {
          type: "string",
          description: "Start date inclusive, YYYY-MM-DD format.",
        },
        toDate: {
          type: "string",
          description: "End date inclusive, YYYY-MM-DD format.",
        },
        minAmount: {
          type: "number",
          description: "Minimum transaction amount in INR.",
        },
        maxAmount: {
          type: "number",
          description: "Maximum transaction amount in INR.",
        },
        direction: {
          type: "string",
          enum: ["debit", "credit"],
          description: "Filter to only debits (money out) or credits (money in).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_transaction_summary",
    description:
      "Get aggregated totals grouped by category, month, or payee. Use for questions like 'how much did I spend on groceries', 'my monthly spending trend', 'top merchants this year'.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromDate: {
          type: "string",
          description: "Start date inclusive, YYYY-MM-DD format.",
        },
        toDate: {
          type: "string",
          description: "End date inclusive, YYYY-MM-DD format.",
        },
        groupBy: {
          type: "string",
          enum: ["category", "month", "payee"],
          description: "Dimension to group results by.",
        },
        direction: {
          type: "string",
          enum: ["debit", "credit"],
          description: "Summarise only debits or credits.",
        },
      },
      required: ["groupBy"],
    },
  },
  {
    name: "get_fixed_deposits",
    description:
      "Get all active fixed deposits with principal, interest rate, maturity date, and latest renewal details.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_equity_holdings",
    description:
      "Get current equity holdings (stocks, mutual funds) from Zerodha Kite with quantity, current value, and P&L.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_gold_holdings",
    description:
      "Get gold items with weight, karat, and current market value based on the latest gold rate.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_net_worth_summary",
    description:
      "Get total net worth broken down by asset class: fixed deposits, equity, and gold.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat/tool-definitions.ts
git commit -m "feat(chat): add tool definitions"
```

---

## Task 4: Tool Runners (TDD)

**Files:**
- Create: `src/lib/chat/tool-runners.ts`
- Create: `src/lib/chat/tool-runners.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/chat/tool-runners.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runSearchTransactions,
  runGetTransactionSummary,
  runGetFixedDeposits,
  runGetGoldHoldings,
} from "./tool-runners";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: { findMany: vi.fn() },
    fixedDeposit: { findMany: vi.fn() },
    goldItem: { findMany: vi.fn() },
    goldRate: { findFirst: vi.fn() },
    kiteSnapshot: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const makeTxn = (overrides: Partial<{
  id: string; txnDate: Date; normalizedDescription: string;
  prettyDescription: string | null; amount: number;
  direction: string; category: { name: string } | null;
}> = {}) => ({
  id: "txn1",
  txnDate: new Date("2026-03-15"),
  normalizedDescription: "AMRUTA UPI",
  prettyDescription: "Amruta",
  amount: 5000,
  direction: "debit",
  category: null,
  ...overrides,
});

describe("runSearchTransactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns transactions matching keyword as records and citations", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxn()] as never);

    const result = await runSearchTransactions({ keyword: "amruta" }, "user@example.com");

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user@example.com" }),
      })
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: "txn1",
      date: "2026-03-15",
      description: "Amruta",
      amount: 5000,
      direction: "debit",
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].type).toBe("transaction");
  });

  it("returns empty arrays when no transactions found", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never);
    const result = await runSearchTransactions({}, "user@example.com");
    expect(result.records).toHaveLength(0);
    expect(result.citations).toHaveLength(0);
  });

  it("falls back to normalizedDescription when prettyDescription is null", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxn({ prettyDescription: null }),
    ] as never);
    const result = await runSearchTransactions({}, "user@example.com");
    expect(result.records[0].description).toBe("AMRUTA UPI");
  });
});

describe("runGetTransactionSummary groupBy payee", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups debits by normalizedDescription and sums amounts", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxn({ id: "t1", normalizedDescription: "AMRUTA UPI", amount: 5000, direction: "debit" }),
      makeTxn({ id: "t2", normalizedDescription: "AMRUTA UPI", amount: 3000, direction: "debit" }),
      makeTxn({ id: "t3", normalizedDescription: "ZEPTO", amount: 800, direction: "debit" }),
    ] as never);

    const result = await runGetTransactionSummary({ groupBy: "payee" }, "user@example.com");
    const amruta = result.records.find((r: { payee: string }) => r.payee === "AMRUTA UPI");
    expect(amruta?.total).toBe(8000);
    expect(amruta?.count).toBe(2);
  });
});

describe("runGetFixedDeposits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns FD records with maturity date and principal", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      {
        id: "fd1",
        bankName: "SBI",
        principal: 100000,
        interestRate: 7.1,
        maturityDate: new Date("2027-01-01"),
        maturityAmount: 107100,
        renewals: [],
      },
    ] as never);

    const result = await runGetFixedDeposits("user@example.com");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: "fd1",
      bankName: "SBI",
      principal: 100000,
      interestRate: 7.1,
    });
    expect(result.citations[0].type).toBe("fd");
  });
});

describe("runGetGoldHoldings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates current value using latest gold rate and karat weight", async () => {
    vi.mocked(prisma.goldItem.findMany).mockResolvedValue([
      { id: "g1", title: "Chain", weightGrams: 10, karat: 22 },
    ] as never);
    vi.mocked(prisma.goldRate.findFirst).mockResolvedValue({
      rate24kPerG: 9000,
      rate22kPerG: 8250,
      date: new Date("2026-04-23"),
    } as never);

    const result = await runGetGoldHoldings("user@example.com");
    expect(result.records[0].currentValue).toBe(82500); // 10g * 8250
    expect(result.citations[0].type).toBe("gold");
  });

  it("returns empty when no gold items", async () => {
    vi.mocked(prisma.goldItem.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.goldRate.findFirst).mockResolvedValue(null as never);
    const result = await runGetGoldHoldings("user@example.com");
    expect(result.records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- tool-runners
```

Expected: FAIL — module `./tool-runners` not found.

- [ ] **Step 3: Implement tool runners**

```typescript
// src/lib/chat/tool-runners.ts
import { prisma } from "@/lib/prisma";
import type { Citation } from "./types";

type ToolResult = { records: unknown[]; citations: Citation[] };

// ── search_transactions ────────────────────────────────────────────────────

export type SearchTransactionsInput = {
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  direction?: "debit" | "credit";
};

export async function runSearchTransactions(
  input: SearchTransactionsInput,
  userId: string
): Promise<ToolResult> {
  const where: Record<string, unknown> = { userId };

  if (input.keyword) {
    const upper = input.keyword.toUpperCase();
    where.OR = [
      { normalizedDescription: { contains: upper } },
      { prettyDescription: { contains: input.keyword } },
    ];
  }

  if (input.fromDate || input.toDate) {
    const txnDate: Record<string, Date> = {};
    if (input.fromDate) txnDate.gte = new Date(input.fromDate);
    if (input.toDate) txnDate.lte = new Date(input.toDate);
    where.txnDate = txnDate;
  }

  if (input.minAmount !== undefined || input.maxAmount !== undefined) {
    const amount: Record<string, number> = {};
    if (input.minAmount !== undefined) amount.gte = input.minAmount;
    if (input.maxAmount !== undefined) amount.lte = input.maxAmount;
    where.amount = amount;
  }

  if (input.direction) where.direction = input.direction;

  const txns = await prisma.transaction.findMany({
    where,
    orderBy: { txnDate: "desc" },
    take: 50,
    include: { category: true },
  });

  const records = txns.map((t) => ({
    id: t.id,
    date: t.txnDate.toISOString().slice(0, 10),
    description: t.prettyDescription ?? t.normalizedDescription,
    amount: t.amount,
    direction: t.direction,
    category: t.category?.name ?? null,
  }));

  const citations: Citation[] = txns.map((t) => ({
    id: t.id,
    type: "transaction" as const,
    date: t.txnDate.toISOString().slice(0, 10),
    description: t.prettyDescription ?? t.normalizedDescription,
    amount: t.amount,
    direction: t.direction as "debit" | "credit",
  }));

  return { records, citations };
}

// ── get_transaction_summary ────────────────────────────────────────────────

export type GetTransactionSummaryInput = {
  fromDate?: string;
  toDate?: string;
  groupBy: "category" | "month" | "payee";
  direction?: "debit" | "credit";
};

export async function runGetTransactionSummary(
  input: GetTransactionSummaryInput,
  userId: string
): Promise<ToolResult> {
  const where: Record<string, unknown> = { userId };

  if (input.fromDate || input.toDate) {
    const txnDate: Record<string, Date> = {};
    if (input.fromDate) txnDate.gte = new Date(input.fromDate);
    if (input.toDate) txnDate.lte = new Date(input.toDate);
    where.txnDate = txnDate;
  }

  if (input.direction) where.direction = input.direction;

  const txns = await prisma.transaction.findMany({
    where,
    include: { category: true },
  });

  if (input.groupBy === "month") {
    const byMonth: Record<string, { month: string; total: number; count: number }> = {};
    for (const t of txns) {
      const month = t.txnDate.toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { month, total: 0, count: 0 };
      byMonth[month].total += t.amount;
      byMonth[month].count += 1;
    }
    const records = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    return { records, citations: [] };
  }

  if (input.groupBy === "category") {
    const byCat: Record<string, { category: string; total: number; count: number }> = {};
    for (const t of txns) {
      const cat = t.category?.name ?? "Uncategorised";
      if (!byCat[cat]) byCat[cat] = { category: cat, total: 0, count: 0 };
      byCat[cat].total += t.amount;
      byCat[cat].count += 1;
    }
    const records = Object.values(byCat).sort((a, b) => b.total - a.total);
    return { records, citations: [] };
  }

  // groupBy === "payee"
  const byPayee: Record<string, { payee: string; total: number; count: number }> = {};
  for (const t of txns) {
    const payee = t.normalizedDescription;
    if (!byPayee[payee]) byPayee[payee] = { payee, total: 0, count: 0 };
    byPayee[payee].total += t.amount;
    byPayee[payee].count += 1;
  }
  const records = Object.values(byPayee).sort((a, b) => b.total - a.total).slice(0, 20);
  return { records, citations: [] };
}

// ── get_fixed_deposits ─────────────────────────────────────────────────────

export async function runGetFixedDeposits(userId: string): Promise<ToolResult> {
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId, disabled: false },
    include: {
      renewals: { orderBy: { renewalNumber: "desc" }, take: 1 },
    },
    orderBy: { maturityDate: "asc" },
  });

  const records = fds.map((fd) => {
    const latestRenewal = fd.renewals[0];
    return {
      id: fd.id,
      bankName: fd.bankName,
      principal: latestRenewal?.principal ?? fd.principal,
      interestRate: latestRenewal?.interestRate ?? fd.interestRate,
      startDate: (latestRenewal?.startDate ?? fd.startDate).toISOString().slice(0, 10),
      maturityDate: (latestRenewal?.maturityDate ?? fd.maturityDate).toISOString().slice(0, 10),
      maturityAmount: latestRenewal?.maturityAmount ?? fd.maturityAmount,
    };
  });

  const citations: Citation[] = fds.map((fd) => ({
    id: fd.id,
    type: "fd" as const,
    label: `${fd.bankName} — ₹${fd.principal.toLocaleString("en-IN")}`,
    date: fd.maturityDate.toISOString().slice(0, 10),
  }));

  return { records, citations };
}

// ── get_equity_holdings ────────────────────────────────────────────────────

export async function runGetEquityHoldings(userId: string): Promise<ToolResult> {
  const snapshot = await prisma.kiteSnapshot.findUnique({ where: { userId } });
  if (!snapshot) return { records: [], citations: [] };

  type KiteHolding = {
    tradingsymbol: string;
    quantity: number;
    last_price: number;
    pnl: number;
    average_price: number;
  };

  const holdings: KiteHolding[] = JSON.parse(snapshot.holdingsJson);

  const records = holdings.map((h) => ({
    symbol: h.tradingsymbol,
    quantity: h.quantity,
    currentValue: h.quantity * h.last_price,
    pnl: h.pnl,
    avgPrice: h.average_price,
    lastPrice: h.last_price,
  }));

  const citations: Citation[] = holdings.map((h) => ({
    id: h.tradingsymbol,
    type: "equity" as const,
    label: `${h.tradingsymbol} × ${h.quantity}`,
    amount: h.quantity * h.last_price,
  }));

  return { records, citations };
}

// ── get_gold_holdings ──────────────────────────────────────────────────────

export async function runGetGoldHoldings(userId: string): Promise<ToolResult> {
  const [items, latestRate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId, disabled: false } }),
    prisma.goldRate.findFirst({ orderBy: { date: "desc" } }),
  ]);

  const records = items.map((item) => {
    const ratePerGram =
      item.karat === 24
        ? (latestRate?.rate24kPerG ?? 0)
        : (latestRate?.rate22kPerG ?? 0);
    return {
      id: item.id,
      title: item.title,
      weightGrams: item.weightGrams,
      karat: item.karat,
      currentValue: Math.round(item.weightGrams * ratePerGram),
      ratePerGram,
      rateDate: latestRate?.date.toISOString().slice(0, 10) ?? null,
    };
  });

  const citations: Citation[] = items.map((item) => ({
    id: item.id,
    type: "gold" as const,
    label: `${item.title} — ${item.weightGrams}g ${item.karat}k`,
  }));

  return { records, citations };
}

// ── get_net_worth_summary ──────────────────────────────────────────────────

export async function runGetNetWorthSummary(userId: string): Promise<ToolResult> {
  const [fdResult, equityResult, goldResult] = await Promise.all([
    runGetFixedDeposits(userId),
    runGetEquityHoldings(userId),
    runGetGoldHoldings(userId),
  ]);

  type FDRecord = { principal: number };
  type EquityRecord = { currentValue: number };
  type GoldRecord = { currentValue: number };

  const fdTotal = (fdResult.records as FDRecord[]).reduce((s, fd) => s + fd.principal, 0);
  const equityTotal = (equityResult.records as EquityRecord[]).reduce((s, h) => s + h.currentValue, 0);
  const goldTotal = (goldResult.records as GoldRecord[]).reduce((s, g) => s + g.currentValue, 0);
  const netWorth = fdTotal + equityTotal + goldTotal;

  return {
    records: [
      {
        assetClass: "Fixed Deposits",
        value: fdTotal,
        count: fdResult.records.length,
      },
      {
        assetClass: "Equity",
        value: equityTotal,
        count: equityResult.records.length,
      },
      {
        assetClass: "Gold",
        value: goldTotal,
        count: goldResult.records.length,
      },
      {
        assetClass: "Total Net Worth",
        value: netWorth,
        count: null,
      },
    ],
    citations: [],
  };
}

// ── dispatcher ─────────────────────────────────────────────────────────────

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  switch (name) {
    case "search_transactions":
      return runSearchTransactions(input as SearchTransactionsInput, userId);
    case "get_transaction_summary":
      return runGetTransactionSummary(input as GetTransactionSummaryInput, userId);
    case "get_fixed_deposits":
      return runGetFixedDeposits(userId);
    case "get_equity_holdings":
      return runGetEquityHoldings(userId);
    case "get_gold_holdings":
      return runGetGoldHoldings(userId);
    case "get_net_worth_summary":
      return runGetNetWorthSummary(userId);
    default:
      return { records: [], citations: [] };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- tool-runners
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/tool-runners.ts src/lib/chat/tool-runners.test.ts
git commit -m "feat(chat): add tool runners with tests"
```

---

## Task 5: API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create the streaming POST route**

```typescript
// src/app/api/chat/route.ts
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { anthropic } from "@/lib/anthropic";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { TOOL_DEFINITIONS } from "@/lib/chat/tool-definitions";
import { runTool } from "@/lib/chat/tool-runners";
import type { SSEChunk } from "@/lib/chat/types";

export const runtime = "nodejs";

function encode(chunk: SSEChunk): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { messages } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      // Phase 1: non-streaming call to handle tool use
      const firstResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      const toolUseBlocks = firstResponse.content.filter((b) => b.type === "tool_use");
      const allCitations: import("@/lib/chat/types").Citation[] = [];

      if (toolUseBlocks.length > 0) {
        // Run all requested tools in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") return null;
            const { records, citations } = await runTool(
              block.name,
              block.input as Record<string, unknown>,
              userId
            );
            allCitations.push(...citations);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(records),
            };
          })
        );

        // Phase 2: stream final response with tool results injected
        const finalStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            ...messages,
            { role: "assistant" as const, content: firstResponse.content },
            {
              role: "user" as const,
              content: toolResults.filter(Boolean) as {
                type: "tool_result";
                tool_use_id: string;
                content: string;
              }[],
            },
          ],
        });

        for await (const event of finalStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            await writer.write(encode({ type: "text", content: event.delta.text }));
          }
        }
      } else {
        // No tool calls — send existing text directly
        const text = firstResponse.content.find((b) => b.type === "text");
        if (text && text.type === "text") {
          await writer.write(encode({ type: "text", content: text.text }));
        }
      }

      // Send citations after text
      if (allCitations.length > 0) {
        await writer.write(encode({ type: "citations", records: allCitations }));
      }

      await writer.write(encode({ type: "done" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await writer.write(encode({ type: "error", message }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Check `src/lib/session.ts` exports `getSessionUserId`**

Look at `src/lib/auth.ts` — the project exports `getSessionUserId` from `src/lib/auth.ts`, not `src/lib/session.ts`. Fix the import if needed:

```typescript
// Change the import at the top of route.ts if getSessionUserId lives in auth.ts:
import { getSessionUserId } from "@/lib/auth";
```

Run: `grep -r "export.*getSessionUserId" src/lib/`

Use whatever path that grep returns.

- [ ] **Step 3: Manual smoke test**

Start the dev server: `npm run dev`

In a separate terminal, run:

```bash
curl -s -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' \
  --cookie "next-auth.session-token=<your-session-token>"
```

Expected: SSE stream with `data: {"type":"text","content":"..."}` lines followed by `data: {"type":"done"}`.

If you get `{"error":"Unauthorized"}`, add a valid session cookie from your browser's DevTools → Application → Cookies.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(chat): add streaming chat API route"
```

---

## Task 6: ChatMessage Component

**Files:**
- Create: `src/components/chat/ChatMessage.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/chat/ChatMessage.tsx
"use client";

import { useState } from "react";
import type { ChatMessage as ChatMessageType, Citation } from "@/lib/chat/types";

function CitationBlock({ records }: { records: Citation[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 text-xs">
      <button
        className="flex w-full items-center gap-1 px-3 py-2 text-blue-700 font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span>📎 {records.length} source{records.length !== 1 ? "s" : ""}</span>
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="border-t border-blue-200 px-3 py-2 space-y-1 text-blue-900">
          {records.slice(0, 10).map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="truncate">
                {c.date && <span className="text-blue-500 mr-1">{c.date}</span>}
                {c.description ?? c.label ?? c.id}
              </span>
              {c.amount !== undefined && (
                <span className={c.direction === "credit" ? "text-green-600" : ""}>
                  {c.direction === "debit" ? "-" : "+"}₹
                  {c.amount.toLocaleString("en-IN")}
                </span>
              )}
            </li>
          ))}
          {records.length > 10 && (
            <li className="text-blue-500">+{records.length - 10} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-[#1e293b] text-white"
              : "rounded-bl-sm bg-[#f1f5f9] text-[#1e293b]"
          }`}
        >
          {message.content}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationBlock records={message.citations} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatMessage.tsx
git commit -m "feat(chat): add ChatMessage component with citation block"
```

---

## Task 7: ChatInput Component

**Files:**
- Create: `src/components/chat/ChatInput.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/chat/ChatInput.tsx
"use client";

import { useState, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex gap-2 border-t border-[#e2e8f0] p-2">
      <textarea
        className="flex-1 resize-none rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
        rows={1}
        placeholder={disabled ? "Thinking…" : "Ask anything about your finances…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button
        className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-white disabled:opacity-40"
        onClick={submit}
        disabled={disabled || !value.trim()}
      >
        ↑
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "feat(chat): add ChatInput component"
```

---

## Task 8: ChatPanel Component

**Files:**
- Create: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/chat/ChatPanel.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import type { ChatMessage, Citation, SSEChunk } from "@/lib/chat/types";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

const STARTERS = [
  "How much did I spend this month?",
  "What's my total FD value?",
  "Show my net worth summary",
];

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Append a placeholder for streaming assistant message
    const assistantIndex = updatedMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok || !response.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIndex] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
          return next;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let citations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const chunk = JSON.parse(line.slice(6)) as SSEChunk;

          if (chunk.type === "text") {
            setMessages((prev) => {
              const next = [...prev];
              next[assistantIndex] = {
                ...next[assistantIndex],
                content: next[assistantIndex].content + chunk.content,
              };
              return next;
            });
          } else if (chunk.type === "citations") {
            citations = chunk.records;
          } else if (chunk.type === "error") {
            setMessages((prev) => {
              const next = [...prev];
              next[assistantIndex] = {
                role: "assistant",
                content: `Error: ${chunk.message}`,
              };
              return next;
            });
          } else if (chunk.type === "done") {
            if (citations.length > 0) {
              setMessages((prev) => {
                const next = [...prev];
                next[assistantIndex] = {
                  ...next[assistantIndex],
                  citations,
                };
                return next;
              });
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0f172a] px-4 py-3">
        <span className="text-sm font-semibold text-white">✨ Financial Assistant</span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b]">Try asking:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#f1f5f9]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessageComponent key={i} message={msg} />)
        )}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-1 px-3 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={send} disabled={loading} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat(chat): add ChatPanel with SSE streaming and suggested starters"
```

---

## Task 9: ChatWidget (Root Component)

**Files:**
- Create: `src/components/chat/ChatWidget.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/chat/ChatWidget.tsx
"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="h-[520px] w-[340px] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl flex flex-col">
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f172a] text-xl text-white shadow-lg hover:bg-[#1e293b] transition-colors"
        aria-label="Open financial assistant"
      >
        {open ? "✕" : "✨"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/ChatWidget.tsx
git commit -m "feat(chat): add ChatWidget FAB component"
```

---

## Task 10: Mount in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add ChatWidget to the layout**

Current `src/app/layout.tsx` body:

```typescript
<body className="min-h-screen bg-[#17171a] text-[#ededed] antialiased">
  {children}
</body>
```

Replace with:

```typescript
import { ChatWidget } from "@/components/chat/ChatWidget";

// inside the body:
<body className="min-h-screen bg-[#17171a] text-[#ededed] antialiased">
  {children}
  <ChatWidget />
</body>
```

The full updated file:

```typescript
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/chat/ChatWidget";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyFolio",
  description: "Personal investment portfolio tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#17171a] text-[#ededed] antialiased">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run the dev server and verify the widget appears**

```bash
npm run dev
```

Open `http://localhost:3000` — you should see the `✨` FAB button in the bottom-right corner.

Click it → the chat panel opens with suggested starters.  
Type "What's my total FD value?" → the panel streams a response.  
Type a follow-up "Which one matures soonest?" → Claude answers using conversation history.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npm run test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(chat): mount ChatWidget in root layout"
```
