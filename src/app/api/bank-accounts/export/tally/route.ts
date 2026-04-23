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
