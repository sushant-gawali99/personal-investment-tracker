import { prisma } from "@/lib/prisma";
import { linkTransactionToFd } from "./link";
import { resolveFdCategories } from "./categories";
import type { MatchCandidate } from "./types";

/**
 * After a bank-statement commit: scan the user's still-unlinked transactions,
 * attach fdId / fdTxnType / categoryId where we can identify the FD.
 *
 * Conservative by design:
 *   - Only touches rows where `fdId IS NULL` (won't re-link).
 *   - Only overrides category when `categorySource !== "user"`.
 *   - Skips when the user has zero active FDs (nothing to match against).
 *
 * Safe to call repeatedly — running it twice in a row is a no-op on the
 * second call because all matches from the first call now have `fdId`.
 */
export async function linkTransactionsAfterImport(userId: string): Promise<{ linked: number }> {
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId, disabled: false },
    select: { id: true, fdNumber: true, accountNumber: true },
  });
  if (fds.length === 0) return { linked: 0 };

  const candidates: MatchCandidate[] = fds.map((f) => ({
    fdId: f.id, fdNumber: f.fdNumber, accountNumber: f.accountNumber,
  }));
  const categories = await resolveFdCategories(prisma, userId);

  const rows = await prisma.transaction.findMany({
    where: { userId, fdId: null },
    select: { id: true, description: true, direction: true, categorySource: true },
  });

  let linked = 0;
  for (const row of rows) {
    const result = linkTransactionToFd(
      { description: row.description, direction: row.direction as "debit" | "credit" },
      candidates,
      categories,
    );
    if (!result) continue;

    const data: {
      fdId: string;
      fdTxnType: string;
      categoryId?: string;
      categorySource?: string;
    } = {
      fdId: result.fdId,
      fdTxnType: result.fdTxnType,
    };
    if (row.categorySource !== "user") {
      data.categoryId = result.categoryId;
      data.categorySource = "fd-link";
    }
    await prisma.transaction.update({ where: { id: row.id }, data });
    linked += 1;
  }

  return { linked };
}

/**
 * After an FD is created or its fdNumber/accountNumber changes: scan the
 * user's existing unlinked transactions for descriptions that contain
 * *this FD's* number, and link the ones that match.
 *
 * Uses a SQL `contains` filter as a cheap pre-filter so we don't load the
 * whole ledger for a single new FD. Then runs the same linkTransactionToFd
 * pass against a single-element FD list.
 */
export async function linkTransactionsForFd(userId: string, fdId: string): Promise<{ linked: number }> {
  const fd = await prisma.fixedDeposit.findUnique({
    where: { id: fdId },
    select: { id: true, userId: true, fdNumber: true, accountNumber: true, disabled: true },
  });
  if (!fd || fd.userId !== userId || fd.disabled) return { linked: 0 };

  const candidate: MatchCandidate = {
    fdId: fd.id, fdNumber: fd.fdNumber, accountNumber: fd.accountNumber,
  };

  // Collect the substrings we want to pre-filter on. Always include the
  // raw numeric parts; matchFd handles the "FD-" prefix variants.
  const needles: string[] = [];
  if (fd.fdNumber) needles.push(fd.fdNumber);
  if (fd.accountNumber) {
    needles.push(fd.accountNumber.replace(/^FD[-\s]?/i, ""));
    needles.push(fd.accountNumber);
  }
  const uniqueNeedles = Array.from(new Set(needles.filter((n) => n.length >= 3)));
  if (uniqueNeedles.length === 0) return { linked: 0 };

  const categories = await resolveFdCategories(prisma, userId);

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      fdId: null,
      OR: uniqueNeedles.map((n) => ({ description: { contains: n } })),
    },
    select: { id: true, description: true, direction: true, categorySource: true },
  });

  let linked = 0;
  for (const row of rows) {
    const result = linkTransactionToFd(
      { description: row.description, direction: row.direction as "debit" | "credit" },
      [candidate],
      categories,
    );
    if (!result) continue;

    const data: {
      fdId: string;
      fdTxnType: string;
      categoryId?: string;
      categorySource?: string;
    } = {
      fdId: result.fdId,
      fdTxnType: result.fdTxnType,
    };
    if (row.categorySource !== "user") {
      data.categoryId = result.categoryId;
      data.categorySource = "fd-link";
    }
    await prisma.transaction.update({ where: { id: row.id }, data });
    linked += 1;
  }

  return { linked };
}
