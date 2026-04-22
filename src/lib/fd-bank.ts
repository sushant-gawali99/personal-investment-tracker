export function normalizeBankName(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
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
