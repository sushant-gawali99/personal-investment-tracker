import { prisma } from "@/lib/prisma";
import { findTransferPairs } from "./transfer-detect";
import type { StagedTxn } from "./types";

export interface CommitResult {
  inserted: number;
  transfersDetected: number;
}

/**
 * Persists staged transactions and re-runs transfer detection across the
 * user's full ledger. Safe to call from HTTP handlers or background jobs.
 */
export async function commitImport(
  importId: string,
  userId: string,
  txns: StagedTxn[],
): Promise<CommitResult> {
  const imp = await prisma.statementImport.findFirst({ where: { id: importId, userId } });
  if (!imp) throw new Error("Import not found");

  const kept = txns.filter((t) => !t.skip && !t.isDuplicate);

  const transferCat = await prisma.transactionCategory.findFirst({
    where: { userId: null, kind: "transfer" },
  });

  const { inserted } = await prisma.$transaction(async (tx) => {
    let n = 0;
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
        n++;
      } catch {
        // unique-index collision — dedup race; skip silently
      }
    }
    await tx.statementImport.update({
      where: { id: imp.id },
      data: { status: "saved", newCount: n },
    });
    return { inserted: n };
  });

  // Cross-account transfer detection across the full ledger (post-insert).
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

  return { inserted, transfersDetected: pairs.length };
}
