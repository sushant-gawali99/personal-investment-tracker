import type { Prisma } from "@prisma/client";

/**
 * Builds the duplicate-detection filter for saving an FD.
 *
 * An FD number uniquely identifies a deposit, so when the incoming FD has
 * one, only rows with the same fdNumber — or rows with no fdNumber to
 * compare against — can be duplicates. Same bank + principal + startDate
 * alone is NOT a duplicate: opening several equal deposits at one bank on
 * the same day is normal.
 */
export function buildFdDuplicateWhere(
  userId: string,
  input: {
    bankName: string;
    principal: number;
    startDate: Date;
    fdNumber?: string | null;
  },
): Prisma.FixedDepositWhereInput {
  const { bankName, principal, startDate, fdNumber } = input;
  const heuristic = { bankName, principal, startDate };

  if (fdNumber) {
    return {
      userId,
      OR: [{ fdNumber }, { ...heuristic, fdNumber: null }],
    };
  }
  return { userId, OR: [heuristic] };
}
