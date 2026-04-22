export function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}

interface StagedKey {
  bankRef: string | null;
  txnDate: string;
  amount: number;
  normalizedDescription: string;
}

interface ExistingRow extends StagedKey {
  id: string;
}

export function markDuplicates<T extends StagedKey>(
  staged: T[],
  existing: ExistingRow[],
): Array<T & { isDuplicate: boolean; duplicateOfId: string | null }> {
  const byRef = new Map<string, string>();
  const byFallback = new Map<string, string>();
  for (const e of existing) {
    if (e.bankRef) byRef.set(e.bankRef, e.id);
    const fk = `${e.txnDate}|${amountToPaise(e.amount)}|${e.normalizedDescription}`;
    byFallback.set(fk, e.id);
  }
  return staged.map((s) => {
    let matchId: string | null = null;
    if (s.bankRef && byRef.has(s.bankRef)) matchId = byRef.get(s.bankRef)!;
    else {
      const fk = `${s.txnDate}|${amountToPaise(s.amount)}|${s.normalizedDescription}`;
      if (byFallback.has(fk)) matchId = byFallback.get(fk)!;
    }
    return { ...s, isDuplicate: matchId !== null, duplicateOfId: matchId };
  });
}
