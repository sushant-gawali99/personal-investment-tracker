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
