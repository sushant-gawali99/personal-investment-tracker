/**
 * One-shot backfill: link every existing FixedDeposit to an FdBank and,
 * where a branchName is present, also to an FdBranch.
 *
 * Idempotent: only touches rows that don't already have a bankId / branchId.
 * Run after `prisma db push` has applied the schema change:
 *   npm run db:backfill:fd-banks
 */
import { prisma } from "../../src/lib/prisma";
import {
  normalizeBankName,
  normalizeBranchName,
  findOrCreateFdBank,
  findOrCreateFdBranch,
} from "../../src/lib/fd-bank";

async function main() {
  // ── 1. Banks ──────────────────────────────────────────────────────────
  const fdsWithoutBank = await prisma.fixedDeposit.findMany({
    where: { bankId: null },
    select: { id: true, userId: true, bankName: true },
  });

  console.log(`[backfill banks] ${fdsWithoutBank.length} FDs to link…`);

  // Group by user so the find-or-create within a user is sequential
  // (avoids unique-constraint races for the same (userId, name)).
  const byUser = new Map<string, typeof fdsWithoutBank>();
  for (const fd of fdsWithoutBank) {
    const list = byUser.get(fd.userId) ?? [];
    list.push(fd);
    byUser.set(fd.userId, list);
  }

  let bankLinked = 0;
  let bankSkipped = 0;
  for (const [userId, userFds] of byUser) {
    const namesByNorm = new Map<string, string>(); // norm → first raw name seen
    for (const fd of userFds) {
      const raw = (fd.bankName ?? "").trim();
      if (!raw) continue;
      const norm = normalizeBankName(raw);
      if (!namesByNorm.has(norm)) namesByNorm.set(norm, raw);
    }
    const idByNorm = new Map<string, string>();
    for (const [norm, raw] of namesByNorm) {
      const bank = await findOrCreateFdBank(prisma, userId, raw);
      idByNorm.set(norm, bank.id);
    }
    for (const fd of userFds) {
      const raw = (fd.bankName ?? "").trim();
      if (!raw) { bankSkipped++; continue; }
      const bankId = idByNorm.get(normalizeBankName(raw));
      if (!bankId) { bankSkipped++; continue; }
      await prisma.fixedDeposit.update({ where: { id: fd.id }, data: { bankId } });
      bankLinked++;
    }
  }
  console.log(`[backfill banks] linked=${bankLinked} skipped=${bankSkipped}`);

  // ── 2. Branches ───────────────────────────────────────────────────────
  // After step 1 every FD has bankId set. Link FDs that have a branchName
  // but no branchId yet. Group by (bankId, normalizedBranch) so we create
  // each FdBranch once.
  const fdsForBranch = await prisma.fixedDeposit.findMany({
    where: { branchId: null, branchName: { not: null }, bankId: { not: null } },
    select: { id: true, userId: true, bankId: true, branchName: true },
  });
  console.log(`[backfill branches] ${fdsForBranch.length} FDs to link…`);

  let branchLinked = 0;
  let branchSkipped = 0;
  // Resolve unique (bankId, normBranch) pairs first.
  const branchIdByPair = new Map<string, string>(); // "bankId|norm" → branchId
  for (const fd of fdsForBranch) {
    const raw = (fd.branchName ?? "").trim();
    if (!raw || !fd.bankId) { branchSkipped++; continue; }
    const norm = normalizeBranchName(raw);
    const cacheKey = `${fd.bankId}|${norm}`;
    if (!branchIdByPair.has(cacheKey)) {
      const branch = await findOrCreateFdBranch(prisma, fd.userId, fd.bankId, raw);
      if (!branch) continue;
      branchIdByPair.set(cacheKey, branch.id);
    }
  }
  for (const fd of fdsForBranch) {
    const raw = (fd.branchName ?? "").trim();
    if (!raw || !fd.bankId) { branchSkipped++; continue; }
    const branchId = branchIdByPair.get(`${fd.bankId}|${normalizeBranchName(raw)}`);
    if (!branchId) { branchSkipped++; continue; }
    await prisma.fixedDeposit.update({ where: { id: fd.id }, data: { branchId } });
    branchLinked++;
  }
  console.log(`[backfill branches] linked=${branchLinked} skipped=${branchSkipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
