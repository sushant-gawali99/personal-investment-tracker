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
