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
