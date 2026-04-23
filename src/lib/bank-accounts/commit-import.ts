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

  // Batch-insert outside an interactive transaction. Against Turso, each
  // round-trip is ~50–100ms, so the old per-row loop inside $transaction
  // blew the default 5s timeout on even modest statements. createMany sends
  // a single statement, and skipDuplicates handles the rare dedup race.
  const rows = kept.map((t) => ({
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
  }));

  let inserted = 0;
  if (rows.length > 0) {
    // Chunk to stay well under libsql's parameter limit (default ~1000).
    // With ~14 columns per row, 500 rows = ~7000 params — safe.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const res = await prisma.transaction.createMany({
        data: slice,
        skipDuplicates: true,
      });
      inserted += res.count;
    }
  }

  await prisma.statementImport.update({
    where: { id: imp.id },
    data: { status: "saved", newCount: inserted },
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
    // Two parallel updates per pair. Not wrapped in $transaction — if one
    // succeeds and the other fails the worst case is a half-tagged pair,
    // which the next import run will re-detect and fix.
    await Promise.all([
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
