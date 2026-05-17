/**
 * One-shot backfill: link every existing FixedDeposit to an FdBank.
 *
 * For each (userId, normalizedBankName) group, create an FdBank if one
 * doesn't exist, then point every FD in that group at it via bankId. Safe
 * to re-run — skips FDs that already have a bankId.
 *
 * Run after `prisma db push` has applied the schema change:
 *   tsx prisma/seeds/backfill-fd-banks.ts
 */
import { prisma } from "../../src/lib/prisma";
import { normalizeBankName, findOrCreateFdBank } from "../../src/lib/fd-bank";

async function main() {
  const fds = await prisma.fixedDeposit.findMany({
    where: { bankId: null },
    select: { id: true, userId: true, bankName: true },
  });

  console.log(`[backfill] ${fds.length} FDs to link…`);

  // Group by user so the find-or-create within a user is sequential
  // (avoids unique-constraint races for the same (userId, name)).
  const byUser = new Map<string, typeof fds>();
  for (const fd of fds) {
    const list = byUser.get(fd.userId) ?? [];
    list.push(fd);
    byUser.set(fd.userId, list);
  }

  let linked = 0;
  let skipped = 0;
  for (const [userId, userFds] of byUser) {
    // First: build a unique set of normalized names for this user and
    // resolve them to FdBank ids. Doing this once per name avoids the
    // find-or-create cost on every FD.
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

    // Second: link every FD in this user to the resolved bank id.
    for (const fd of userFds) {
      const raw = (fd.bankName ?? "").trim();
      if (!raw) { skipped++; continue; }
      const bankId = idByNorm.get(normalizeBankName(raw));
      if (!bankId) { skipped++; continue; }
      await prisma.fixedDeposit.update({
        where: { id: fd.id },
        data: { bankId },
      });
      linked++;
    }
  }

  console.log(`[backfill] linked=${linked} skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
