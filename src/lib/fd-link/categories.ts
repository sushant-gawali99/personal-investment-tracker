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
 * Lookups prefer user-scoped categories, fall back to the preset (userId=null).
 * Missing categories are created for the user.
 *
 * `other` is intentionally not in the map — those rows are left uncategorised.
 *
 * `db` is typed as PrismaClient so this works with the real client; tests
 * pass a fake that implements `transactionCategory.findMany` + `create`.
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
    },
  });

  const byName = new Map<string, string>();
  // Prefer user-scoped over preset: walk preset rows first so user rows overwrite them.
  for (const row of existing.filter((r) => r.userId === null)) byName.set(row.name, row.id);
  for (const row of existing.filter((r) => r.userId !== null)) byName.set(row.name, row.id);

  for (const name of names) {
    if (byName.has(name)) continue;
    const created = await db.transactionCategory.create({
      data: { userId, name, kind: NAME_TO_KIND[name] },
    });
    byName.set(name, created.id);
  }

  const result = new Map<FdTxnType, string>();
  for (const [type, name] of Object.entries(FD_TXN_TYPE_TO_CATEGORY_NAME) as Array<[Exclude<FdTxnType, "other">, string]>) {
    const id = byName.get(name);
    if (id) result.set(type, id);
  }
  return result;
}
