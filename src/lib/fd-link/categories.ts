import type { PrismaClient } from "@prisma/client";
import type { FdTxnType } from "./types";

/**
 * Maps every FD transaction type (except "other") to the *display name* of
 * the TransactionCategory that links should use.
 */
export const FD_TXN_TYPE_TO_CATEGORY_NAME: Record<Exclude<FdTxnType, "other">, string> = {
  interest:        "FD Interest",
  maturity:        "FD Maturity",
  premature_close: "FD Maturity",
  tds:             "TDS",
  transfer_in:     "Transfer",
  transfer_out:    "Transfer",
};

const NAME_TO_KIND: Record<string, "income" | "expense" | "transfer"> = {
  "FD Interest": "income",
  "FD Maturity": "income",
  "TDS":         "expense",
  "Transfer":    "transfer",
};

/**
 * Returns a Map from FdTxnType to TransactionCategory.id for a user.
 *
 * Lookup order per category name:
 *   1. Active (`disabled: false`) user-scoped row, if any.
 *   2. Active preset row (`userId = null`), if any.
 *   3. Otherwise, create a new active user-scoped row.
 *
 * On create we rely on the `@@unique([userId, name])` constraint to protect
 * against two concurrent callers both reaching step 3. If `create` throws
 * P2002, we re-read and either (a) pick up the row the race-winner inserted
 * or (b) re-enable a previously-disabled user row that was blocking the
 * insert. Re-enabling is the user-intent-preserving choice here: the user's
 * "hide from pickers" preference conflicts with "auto-link this txn type",
 * and resolving silently to "link anyway" is less surprising than leaving
 * the row uncategorised.
 *
 * `other` is intentionally not in the returned map — those rows stay
 * uncategorised.
 */
export async function resolveFdCategories(
  db: Pick<PrismaClient, "transactionCategory">,
  userId: string,
): Promise<Map<FdTxnType, string>> {
  const names = Array.from(new Set(Object.values(FD_TXN_TYPE_TO_CATEGORY_NAME)));

  const existing = await db.transactionCategory.findMany({
    where: {
      OR: [{ userId }, { userId: null }],
      name: { in: names },
      disabled: false,
    },
  });

  const byName = new Map<string, string>();
  // Walk preset rows first so user-scoped rows overwrite them.
  for (const row of existing.filter((r) => r.userId === null)) byName.set(row.name, row.id);
  for (const row of existing.filter((r) => r.userId !== null)) byName.set(row.name, row.id);

  for (const name of names) {
    if (byName.has(name)) continue;
    try {
      const created = await db.transactionCategory.create({
        data: { userId, name, kind: NAME_TO_KIND[name] },
      });
      byName.set(name, created.id);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // P2002 on (userId, name): either a concurrent caller won the race,
      // or a disabled row is blocking the insert. Re-read including
      // disabled rows, then re-enable if needed.
      const blocker = await db.transactionCategory.findFirst({
        where: { userId, name },
      });
      if (!blocker) throw err;
      if (blocker.disabled) {
        await db.transactionCategory.update({
          where: { id: blocker.id },
          data: { disabled: false },
        });
      }
      byName.set(name, blocker.id);
    }
  }

  const result = new Map<FdTxnType, string>();
  for (const [type, name] of Object.entries(FD_TXN_TYPE_TO_CATEGORY_NAME) as Array<[Exclude<FdTxnType, "other">, string]>) {
    const id = byName.get(name);
    if (id) result.set(type, id);
  }
  return result;
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "P2002";
}
