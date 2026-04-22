export interface FDRecord {
  id: string;
  bankName: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  tenureDays: number;
  startDate: Date | string;
  maturityDate: Date | string;
  maturityAmount: number | null;
  interestType: string;
  compoundFreq: string | null;
}

export interface Holding {
  tradingsymbol: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
}

export interface MFHolding {
  tradingsymbol: string;
  fund: string;
  quantity: number;
  average_price: number;
  last_price: number;
}

// ── FD Analytics ──────────────────────────────────────────────────────────────

export function fdMaturityValue(fd: FDRecord): number {
  if (fd.maturityAmount) return fd.maturityAmount;
  const rate = fd.interestRate / 100;
  const years = fd.tenureMonths / 12 + fd.tenureDays / 365;
  if (fd.interestType === "simple") {
    return fd.principal * (1 + rate * years);
  }
  const n = fd.compoundFreq === "monthly" ? 12 : fd.compoundFreq === "annually" ? 1 : 4;
  return fd.principal * Math.pow(1 + rate / n, n * years);
}

export function fdInterestThisYear(fd: FDRecord): number {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  const start = new Date(fd.startDate);
  const end = new Date(fd.maturityDate);

  const overlapStart = start < yearStart ? yearStart : start;
  const overlapEnd = end > yearEnd ? yearEnd : end;
  if (overlapStart >= overlapEnd) return 0;

  const days = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000;
  return (fd.principal * fd.interestRate / 100) * (days / 365);
}

export function fdInterestAccruedToDate(fd: FDRecord): number {
  const now = new Date();
  const start = new Date(fd.startDate);
  const end = new Date(fd.maturityDate);
  if (now <= start) return 0;
  const cap = now > end ? end : now;
  const elapsed = (cap.getTime() - start.getTime()) / 86400000;
  const total = (end.getTime() - start.getTime()) / 86400000;
  const totalInterest = fdMaturityValue(fd) - fd.principal;
  return total > 0 ? (elapsed / total) * totalInterest : 0;
}

export function fdSummary(fds: FDRecord[]) {
  const totalPrincipal = fds.reduce((s, fd) => s + fd.principal, 0);
  const totalMaturity = fds.reduce((s, fd) => s + fdMaturityValue(fd), 0);
  const totalInterest = totalMaturity - totalPrincipal;
  const interestThisYear = fds.reduce((s, fd) => s + fdInterestThisYear(fd), 0);
  const interestAccrued = fds.reduce((s, fd) => s + fdInterestAccruedToDate(fd), 0);
  const weightedRate =
    totalPrincipal > 0
      ? fds.reduce((s, fd) => s + fd.principal * fd.interestRate, 0) / totalPrincipal
      : 0;

  const now = new Date();
  const upcoming30 = fds.filter((fd) => {
    const d = daysUntil(fd.maturityDate);
    return d >= 0 && d <= 30;
  });
  const upcoming90 = fds.filter((fd) => {
    const d = daysUntil(fd.maturityDate);
    return d >= 0 && d <= 90;
  });

  return { totalPrincipal, totalMaturity, totalInterest, interestThisYear, interestAccrued, weightedRate, upcoming30, upcoming90, count: fds.length, now };
}

// ── Equity Analytics ──────────────────────────────────────────────────────────

export function equitySummary(holdings: Holding[]) {
  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0);
  const currentValue = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0);
  const totalPnL = currentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  return { totalInvested, currentValue, totalPnL, totalPnLPct };
}

// ── MF Analytics ─────────────────────────────────────────────────────────────

export function mfSummary(holdings: MFHolding[]) {
  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0);
  const currentValue = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0);
  const totalPnL = currentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  return { totalInvested, currentValue, totalPnL, totalPnLPct };
}

// ── Combined Portfolio ────────────────────────────────────────────────────────

export function portfolioSummary(holdings: Holding[], fds: FDRecord[], mfHoldings: MFHolding[] = []) {
  const eq = equitySummary(holdings);
  const mf = mfSummary(mfHoldings);
  const fd = fdSummary(fds);

  const totalCapital = eq.totalInvested + fd.totalPrincipal + mf.totalInvested;
  const totalValue = eq.currentValue + fd.totalMaturity + mf.currentValue;

  const fdWeightedYears =
    fd.totalPrincipal > 0
      ? fds.reduce((s, f) => s + (f.tenureMonths / 12 + f.tenureDays / 365) * f.principal, 0) / fd.totalPrincipal
      : 0;
  const equityYears = 2;
  const avgYears =
    totalCapital > 0
      ? ((eq.totalInvested + mf.totalInvested) * equityYears + fd.totalPrincipal * fdWeightedYears) / totalCapital
      : 1;

  const cagr =
    totalCapital > 0 && avgYears > 0
      ? (Math.pow(totalValue / totalCapital, 1 / avgYears) - 1) * 100
      : 0;

  const equityPct = totalValue > 0 ? (eq.currentValue / totalValue) * 100 : 0;
  const fdPct = totalValue > 0 ? (fd.totalMaturity / totalValue) * 100 : 0;
  const mfPct = totalValue > 0 ? (mf.currentValue / totalValue) * 100 : 0;

  return { totalCapital, totalValue, cagr, equityPct, fdPct, mfPct, equity: eq, fd, mf };
}

// ── FD interest accrual timeline (monthly) ───────────────────────────────────

export function fdAccrualTimeline(fds: FDRecord[], monthsAhead = 24) {
  const now = new Date();
  const points: { month: string; accrued: number; projected: number }[] = [];

  for (let i = -6; i <= monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    let accrued = 0;
    let projected = 0;

    for (const fd of fds) {
      const start = new Date(fd.startDate);
      const end = new Date(fd.maturityDate);
      if (d < start || d > end) continue;
      const totalDays = (end.getTime() - start.getTime()) / 86400000;
      const elapsedDays = (d.getTime() - start.getTime()) / 86400000;
      const totalInterest = fdMaturityValue(fd) - fd.principal;
      const interestAtPoint = totalDays > 0 ? (elapsedDays / totalDays) * totalInterest : 0;

      if (d <= now) accrued += interestAtPoint;
      else projected += interestAtPoint;
    }

    points.push({ month: label, accrued, projected });
  }

  return points;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(date: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}
