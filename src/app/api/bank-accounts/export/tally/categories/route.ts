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
