import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { findTransferPairs } from "@/lib/bank-accounts/transfer-detect";
import type { StagedTxn } from "@/lib/bank-accounts/types";

interface CommitBody {
  txns: StagedTxn[];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as CommitBody;
  const kept = body.txns.filter((t) => !t.skip && !t.isDuplicate);

  const transferCat = await prisma.transactionCategory.findFirst({
    where: { userId: null, kind: "transfer" },
  });

  const result = await prisma.$transaction(async (tx) => {
    let inserted = 0;
    for (const t of kept) {
      try {
        await tx.transaction.create({
          data: {
            userId,
            accountId: imp.accountId,
            txnDate: new Date(t.txnDate),
            valueDate: t.valueDate ? new Date(t.valueDate) : null,
            description: t.description,
            normalizedDescription: t.normalizedDescription,
            amount: t.amount,
            direction: t.direction,
            runningBalance: t.runningBalance,
            bankRef: t.bankRef,
            categoryId: t.categoryId,
            categorySource: t.categorySource,
            importId: imp.id,
          },
        });
        inserted++;
      } catch {
        // unique-index collision — dedup race; skip silently
      }
    }
    await tx.statementImport.update({
      where: { id: imp.id },
      data: { status: "saved", newCount: inserted },
    });
    return { inserted };
  });

  const all = await prisma.transaction.findMany({
    where: { userId },
    select: {
      id: true, accountId: true, txnDate: true, amount: true, direction: true,
      transferGroupId: true, categorySource: true, description: true,
    },
  });
  const lite = all.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    txnDate: t.txnDate.toISOString().slice(0, 10),
    amount: t.amount,
    direction: t.direction as "debit" | "credit",
    transferGroupId: t.transferGroupId,
    categorySource: t.categorySource,
    description: t.description,
  }));
  const pairs = findTransferPairs(lite);
  for (const p of pairs) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: p.debitId },
        data: {
          transferGroupId: p.groupId,
          categoryId: transferCat?.id ?? null,
          categorySource: "transfer-detect",
        },
      }),
      prisma.transaction.update({
        where: { id: p.creditId },
        data: {
          transferGroupId: p.groupId,
          categoryId: transferCat?.id ?? null,
          categorySource: "transfer-detect",
        },
      }),
    ]);
  }

  return NextResponse.json({ inserted: result.inserted, transfersDetected: pairs.length });
}
