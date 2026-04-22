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
