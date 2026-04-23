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
  // Sort: allow list-header toggling on date / amount. Default matches prior
  // behaviour (most-recent first, then insertion order).
  const sortField = url.searchParams.get("sort") === "amount" ? "amount" : "txnDate";
  const sortOrder = url.searchParams.get("order") === "asc" ? "asc" : "desc";

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

  // Header totals exclude transfer-kind categories so they line up with the
  // analytics overview page (which also excludes transfers from its
  // spending/income/net stats — transfers are money moving between the
  // user's own accounts, not real income/expense).
  // Only applied when the user hasn't filtered by a specific category —
  // if they explicitly asked for the Transfer category, show its totals.
  const excludeTransfers = categoryIds.length === 0
    ? { NOT: { category: { is: { kind: "transfer" } } } }
    : {};

  const [items, total, debitAgg, creditAgg, excludedCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy:
        sortField === "amount"
          ? [{ amount: sortOrder }, { txnDate: "desc" }]
          : [{ txnDate: sortOrder }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        account: true,
        fd: { select: { id: true, bankName: true, fdNumber: true, accountNumber: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({ where: { ...where, direction: "debit",  ...excludeTransfers }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, direction: "credit", ...excludeTransfers }, _sum: { amount: true } }),
    categoryIds.length === 0
      ? prisma.transaction.count({ where: { ...where, category: { is: { kind: "transfer" } } } })
      : Promise.resolve(0),
  ]);
  return NextResponse.json({
    items, total, page, pageSize,
    totalDebit:  debitAgg._sum.amount  ?? 0,
    totalCredit: creditAgg._sum.amount ?? 0,
    // Number of rows in the current filter that are transfers (and therefore
    // excluded from totalDebit/totalCredit). The UI uses this to show
    // "excl. N transfers" next to the summary.
    transferCount: excludedCount,
  });
}
