import type { Holding, MFHolding, FDRecord } from './analytics'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfData {
  userEmail: string
  generatedAt: Date
  totalValue: number
  equity: { totalInvested: number; currentValue: number; totalPnL: number; pnlPct: number }
  fd: { totalMaturity: number; totalPrincipal: number; weightedRate: number }
  gold: { currentValue: number; gainLossPct: number | null }
  mf: { totalInvested: number; currentValue: number; totalPnL: number }
  cagr: number
  fdsByBank: { bankName: string; total: number }[]
  holdings: { symbol: string; value: number }[]
  timeline: { month: string; accrued: number; projected: number }[]
  upcomingMaturities: { bankName: string; maturityDate: string; amount: number; daysRemaining: number }[]
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmtINRPdf(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.round(Math.abs(n))
  const s = abs.toString()
  if (s.length <= 3) return `${sign}Rs.${s}`
  let result = s.slice(-3)
  let rest = s.slice(0, -3)
  while (rest.length > 2) {
    result = rest.slice(-2) + ',' + result
    rest = rest.slice(0, -2)
  }
  return `${sign}Rs.${rest},${result}`
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const f = (n: number) => n.toFixed(2)

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const end = endDeg - startDeg >= 360 ? startDeg + 359.99 : endDeg
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180
  const sx = cx + r * Math.cos(toRad(startDeg))
  const sy = cy + r * Math.sin(toRad(startDeg))
  const ex = cx + r * Math.cos(toRad(end))
  const ey = cy + r * Math.sin(toRad(end))
  const large = end - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${f(sx)} ${f(sy)} A ${r} ${r} 0 ${large} 1 ${f(ex)} ${f(ey)} Z`
}

// ── Data builder ──────────────────────────────────────────────────────────────

interface RawProps {
  summary: {
    totalValue: number
    totalCapital: number
    cagr: number
    equityPct: number
    fdPct: number
    mfPct: number
    equity: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number }
    fd: { totalPrincipal: number; totalMaturity: number; totalInterest: number; interestThisYear: number; weightedRate: number }
    mf: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number }
  }
  timeline: { month: string; accrued: number; projected: number }[]
  holdings: Holding[]
  mfHoldings: MFHolding[]
  goldTotals: { count: number; currentValue: number; invested: number; gainLoss: number | null; hasRate: boolean }
  upcomingMaturities: FDRecord[]
  fdsByBank: { bankName: string; total: number }[]
}

function firstTwoWords(s: string) {
  return s.split(/\s+/).slice(0, 2).join(' ')
}

export function buildPdfData(props: RawProps, userEmail: string): PdfData {
  const { summary, timeline, holdings, mfHoldings, goldTotals, upcomingMaturities, fdsByBank } = props
  const equityItems = holdings.map(h => ({ symbol: h.tradingsymbol, value: h.last_price * h.quantity }))
  const mfItems = mfHoldings.map(h => ({ symbol: firstTwoWords(h.fund), value: h.last_price * h.quantity }))
  const topHoldings = [...equityItems, ...mfItems]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const invested = goldTotals.invested
  const gainLossPct =
    goldTotals.gainLoss != null && invested > 0
      ? (goldTotals.gainLoss / invested) * 100
      : null

  return {
    userEmail,
    generatedAt: new Date(),
    totalValue: summary.totalValue,
    equity: { totalInvested: summary.equity.totalInvested, currentValue: summary.equity.currentValue, totalPnL: summary.equity.totalPnL, pnlPct: summary.equity.totalPnLPct },
    fd: {
      totalMaturity: summary.fd.totalMaturity,
      totalPrincipal: summary.fd.totalPrincipal,
      weightedRate: summary.fd.weightedRate,
    },
    gold: { currentValue: goldTotals.currentValue, gainLossPct },
    mf: {
      totalInvested: summary.mf.totalInvested,
      currentValue: summary.mf.currentValue,
      totalPnL: summary.mf.totalPnL,
    },
    cagr: summary.cagr,
    fdsByBank,
    holdings: topHoldings,
    timeline,
    upcomingMaturities: upcomingMaturities.map(fd => ({
      bankName: fd.bankName,
      maturityDate: new Date(fd.maturityDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      amount: fd.maturityAmount ?? fd.principal,
      daysRemaining: Math.round(
        (new Date(fd.maturityDate).getTime() - Date.now()) / 86_400_000,
      ),
    })),
  }
}
