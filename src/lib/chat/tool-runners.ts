// src/lib/chat/tool-runners.ts
import { prisma } from "@/lib/prisma";
import type { Citation } from "./types";

type ToolResult = { records: Record<string, unknown>[]; citations: Citation[] };

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
      startDate: (latestRenewal?.startDate ?? fd.startDate)?.toISOString().slice(0, 10) ?? null,
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

  let holdings: KiteHolding[];
  try {
    holdings = JSON.parse(snapshot.holdingsJson);
  } catch {
    return { records: [], citations: [] };
  }

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

// ── get_nj_india_mutual_funds ──────────────────────────────────────────────

export async function runGetNJIndiaMutualFunds(userId: string): Promise<ToolResult> {
  const latest = await prisma.nJIndiaStatement.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { records: [], citations: [] };

  type NJScheme = {
    scheme: string;
    subType: string;
    invested: number;
    units: number;
    currentValue: number;
    absoluteReturnPct: number | null;
    annualizedReturnPct: number | null;
    holdingPct: number;
    tenure: string;
  };

  let schemes: NJScheme[] = [];
  try {
    schemes = JSON.parse(latest.schemesJson);
  } catch {
    schemes = [];
  }

  const records = [
    {
      kind: "summary",
      reportDate: latest.reportDate?.toISOString().slice(0, 10) ?? null,
      totalInvested: latest.totalInvested,
      totalCurrentValue: latest.totalCurrentValue,
      totalGainLoss: latest.totalGainLoss,
      weightedReturnPct: latest.weightedReturnPct,
      absoluteReturnPct: latest.absoluteReturnPct,
      schemeCount: latest.schemeCount,
    },
    ...schemes.map((s) => ({
      kind: "scheme",
      scheme: s.scheme,
      subType: s.subType,
      invested: s.invested,
      units: s.units,
      currentValue: s.currentValue,
      gainLoss: s.currentValue - s.invested,
      absoluteReturnPct: s.absoluteReturnPct,
      annualizedReturnPct: s.annualizedReturnPct,
      holdingPct: s.holdingPct,
      tenure: s.tenure,
    })),
  ];

  const citations: Citation[] = schemes.map((s, i) => ({
    id: `nj-${i}`,
    type: "mf" as const,
    label: `${s.scheme} — ${s.subType}`,
    amount: s.currentValue,
  }));

  return { records, citations };
}

// ── get_net_worth_summary ──────────────────────────────────────────────────

export async function runGetNetWorthSummary(userId: string): Promise<ToolResult> {
  const [fdResult, equityResult, goldResult, njResult] = await Promise.all([
    runGetFixedDeposits(userId),
    runGetEquityHoldings(userId),
    runGetGoldHoldings(userId),
    runGetNJIndiaMutualFunds(userId),
  ]);

  type FDRecord = { principal: number };
  type EquityRecord = { currentValue: number };
  type GoldRecord = { currentValue: number };

  const fdTotal = (fdResult.records as FDRecord[]).reduce((s, fd) => s + fd.principal, 0);
  const equityTotal = (equityResult.records as EquityRecord[]).reduce((s, h) => s + h.currentValue, 0);
  const goldTotal = (goldResult.records as GoldRecord[]).reduce((s, g) => s + g.currentValue, 0);

  const njSummary = (njResult.records.find((r) => (r as { kind?: string }).kind === "summary") as
    | { totalCurrentValue: number; schemeCount: number }
    | undefined) ?? null;
  const njTotal = njSummary?.totalCurrentValue ?? 0;
  const njCount = njSummary?.schemeCount ?? 0;

  const netWorth = fdTotal + equityTotal + goldTotal + njTotal;

  return {
    records: [
      { assetClass: "Fixed Deposits", value: fdTotal, count: fdResult.records.length },
      { assetClass: "Equity (Zerodha)", value: equityTotal, count: equityResult.records.length },
      { assetClass: "Mutual Funds (NJ India)", value: njTotal, count: njCount },
      { assetClass: "Gold", value: goldTotal, count: goldResult.records.length },
      { assetClass: "Total Net Worth", value: netWorth, count: null },
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
    case "get_nj_india_mutual_funds":
      return runGetNJIndiaMutualFunds(userId);
    case "get_net_worth_summary":
      return runGetNetWorthSummary(userId);
    default:
      return { records: [], citations: [] };
  }
}
