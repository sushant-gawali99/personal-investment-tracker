import type { PrismaClient } from "@prisma/client";

export function normalizeBankName(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
}

/**
 * Find an FdBank for this user by normalized name, or create one if none
 * matches. Returns the bank's id and canonical display name. Safe to call
 * concurrently — relies on the @@unique([userId, normalizedName]) constraint
 * and retries with a find on collision.
 */
export async function findOrCreateFdBank(
  prisma: PrismaClient,
  userId: string,
  rawName: string,
): Promise<{ id: string; name: string; normalizedName: string }> {
  const name = rawName.trim();
  const normalizedName = normalizeBankName(name);
  if (!normalizedName) throw new Error("Bank name is required");

  const existing = await prisma.fdBank.findUnique({
    where: { userId_normalizedName: { userId, normalizedName } },
    select: { id: true, name: true, normalizedName: true },
  });
  if (existing) return existing;

  try {
    return await prisma.fdBank.create({
      data: { userId, name, normalizedName },
      select: { id: true, name: true, normalizedName: true },
    });
  } catch {
    // Unique constraint race — another request just created it. Re-fetch.
    const row = await prisma.fdBank.findUnique({
      where: { userId_normalizedName: { userId, normalizedName } },
      select: { id: true, name: true, normalizedName: true },
    });
    if (!row) throw new Error("Failed to find-or-create FdBank");
    return row;
  }
}

export interface BankGroup {
  key: string;
  label: string;
  count: number;
}

export function groupBanks(fds: Array<{ bankName: string }>): BankGroup[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const fd of fds) {
    const key = normalizeBankName(fd.bankName);
    const entry = map.get(key);
    if (!entry) {
      map.set(key, { label: fd.bankName.trim(), count: 1 });
    } else {
      entry.count += 1;
    }
  }
  return Array.from(map.entries())
    .map(([key, { label, count }]) => ({ key, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
