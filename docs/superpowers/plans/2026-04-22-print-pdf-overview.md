# Print PDF Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Print PDF" button to the dashboard overview that generates a client-side PDF summary and opens it in a new browser tab.

**Architecture:** `@react-pdf/renderer` generates the PDF entirely in the browser — no server round-trip. A new `fdsByBank` prop is computed on the server and passed to `OverviewClient`. On button click, `generateOverviewPdf()` dynamically imports the PDF document component, calls `pdf().toBlob()`, and opens the result via `URL.createObjectURL`.

**Tech Stack:** `@react-pdf/renderer`, React 19, Next.js App Router (client component), TypeScript, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/pdf-data.ts` | Pure helpers: `PdfData` type, `buildPdfData()`, `fmtINRPdf()`, `arcPath()` |
| Create | `src/lib/pdf-data.test.ts` | Unit tests for pdf-data helpers |
| Create | `src/components/pdf/charts/AllocationDonut.tsx` | SVG donut chart for @react-pdf/renderer |
| Create | `src/components/pdf/charts/FdByBankBars.tsx` | Horizontal bar chart of FD corpus per bank |
| Create | `src/components/pdf/charts/TopHoldingsBars.tsx` | Horizontal bar chart of top equity holdings |
| Create | `src/components/pdf/charts/FdAccrualArea.tsx` | Area chart of FD interest accrual over 24 months |
| Create | `src/components/pdf/OverviewPdf.tsx` | Full `@react-pdf/renderer` `<Document>` |
| Create | `src/lib/generate-overview-pdf.tsx` | Async trigger: dynamic imports → toBlob → open tab |
| Modify | `src/app/dashboard/page.tsx` | Compute `fdsByBank` + pass `userEmail` to `OverviewClient` |
| Modify | `src/app/dashboard/overview-client.tsx` | Add `fdsByBank` + `userEmail` to Props; add Print button |

---

## Task 1: Install @react-pdf/renderer

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

> Note: `@types/react-pdf` may not exist — that's fine, `@react-pdf/renderer` ships its own types. If the second command errors, ignore it.

- [ ] **Step 2: Verify the install**

```bash
node -e "require('@react-pdf/renderer'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @react-pdf/renderer"
```

---

## Task 2: PDF data helpers

**Files:**
- Create: `src/lib/pdf-data.ts`
- Create: `src/lib/pdf-data.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/pdf-data.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { fmtINRPdf, arcPath, buildPdfData } from './pdf-data'
import type { Holding, FDRecord } from './analytics'

describe('fmtINRPdf', () => {
  it('formats crores correctly', () => {
    expect(fmtINRPdf(4285000)).toBe('Rs.42,85,000')
  })
  it('formats lakhs correctly', () => {
    expect(fmtINRPdf(150000)).toBe('Rs.1,50,000')
  })
  it('formats negative values', () => {
    expect(fmtINRPdf(-50000)).toBe('-Rs.50,000')
  })
  it('formats zero', () => {
    expect(fmtINRPdf(0)).toBe('Rs.0')
  })
})

describe('arcPath', () => {
  it('returns a valid SVG path string', () => {
    const path = arcPath(50, 50, 40, 0, 90)
    expect(path).toMatch(/^M 50 50 L/)
    expect(path).toContain(' A 40 40 0 ')
  })
  it('caps full-circle to 359.99 degrees', () => {
    const path = arcPath(50, 50, 40, 0, 360)
    expect(path).toContain('359.99')
  })
})

describe('buildPdfData', () => {
  const minimalProps = {
    summary: {
      totalValue: 100000,
      totalCapital: 80000,
      cagr: 11.8,
      equityPct: 42,
      fdPct: 35,
      mfPct: 11,
      equity: { totalInvested: 40000, currentValue: 42000, totalPnL: 2000, totalPnLPct: 5 },
      fd: { totalPrincipal: 35000, totalMaturity: 38000, totalInterest: 3000, interestThisYear: 500, weightedRate: 7.2 },
      mf: { totalInvested: 11000, currentValue: 11500, totalPnL: 500, totalPnLPct: 4.5 },
    },
    timeline: [{ month: 'Jan', accrued: 0, projected: 100 }],
    holdings: [
      { tradingsymbol: 'RELIANCE', quantity: 10, average_price: 2000, last_price: 2500, pnl: 5000 },
      { tradingsymbol: 'TCS', quantity: 5, average_price: 3000, last_price: 3200, pnl: 1000 },
    ] as Holding[],
    mfHoldings: [],
    goldTotals: { count: 1, currentValue: 51000, invested: 45000, gainLoss: 6000, hasRate: true },
    upcomingMaturities: [{
      id: '1', bankName: 'SBI', principal: 100000, interestRate: 7, tenureMonths: 12, tenureDays: 0,
      startDate: new Date('2025-01-01'), maturityDate: new Date('2026-04-30'),
      maturityAmount: 107000, interestType: 'compound', compoundFreq: 'quarterly', tenureText: null,
    }] as FDRecord[],
    fdsByBank: [{ bankName: 'SBI', total: 200000 }, { bankName: 'HDFC', total: 150000 }],
  }

  it('picks top holdings by value', () => {
    const data = buildPdfData(minimalProps, 'test@test.com')
    expect(data.holdings[0].symbol).toBe('RELIANCE') // 10 * 2500 = 25000 > 5 * 3200 = 16000
  })

  it('maps upcomingMaturities to simplified shape', () => {
    const data = buildPdfData(minimalProps, 'test@test.com')
    expect(data.upcomingMaturities[0].bankName).toBe('SBI')
    expect(data.upcomingMaturities[0].amount).toBe(107000)
  })

  it('passes fdsByBank through', () => {
    const data = buildPdfData(minimalProps, 'test@test.com')
    expect(data.fdsByBank).toHaveLength(2)
    expect(data.fdsByBank[0].bankName).toBe('SBI')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- pdf-data
```

Expected: All tests FAIL (module not found).

- [ ] **Step 3: Implement pdf-data.ts**

Create `src/lib/pdf-data.ts`:

```typescript
import type { Holding, FDRecord } from './analytics'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfData {
  userEmail: string
  generatedAt: Date
  totalValue: number
  equity: { currentValue: number; pnlPct: number }
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
  mfHoldings: unknown[]
  goldTotals: { count: number; currentValue: number; invested: number; gainLoss: number | null; hasRate: boolean }
  upcomingMaturities: FDRecord[]
  fdsByBank: { bankName: string; total: number }[]
}

export function buildPdfData(props: RawProps, userEmail: string): PdfData {
  const { summary, timeline, holdings, goldTotals, upcomingMaturities, fdsByBank } = props
  const topHoldings = [...holdings]
    .sort((a, b) => b.last_price * b.quantity - a.last_price * a.quantity)
    .slice(0, 5)
    .map(h => ({ symbol: h.tradingsymbol, value: h.last_price * h.quantity }))
  const invested = goldTotals.invested
  const gainLossPct =
    goldTotals.gainLoss != null && invested > 0
      ? (goldTotals.gainLoss / invested) * 100
      : null

  return {
    userEmail,
    generatedAt: new Date(),
    totalValue: summary.totalValue,
    equity: { currentValue: summary.equity.currentValue, pnlPct: summary.equity.totalPnLPct },
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- pdf-data
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-data.ts src/lib/pdf-data.test.ts
git commit -m "feat(pdf): add PdfData type, buildPdfData, and SVG helpers"
```

---

## Task 3: AllocationDonut chart component

**Files:**
- Create: `src/components/pdf/charts/AllocationDonut.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf/charts/AllocationDonut.tsx`:

```typescript
import { Svg, Path, Circle, G, Text, Rect } from '@react-pdf/renderer'
import { arcPath } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

const COLORS: Record<string, string> = {
  Equity: '#ff385c',
  FD: '#3b82f6',
  Gold: '#f59e0b',
  MF: '#8b5cf6',
}

interface Props {
  data: PdfData
}

export function AllocationDonut({ data }: Props) {
  const total =
    data.equity.currentValue +
    data.fd.totalMaturity +
    data.gold.currentValue +
    data.mf.currentValue

  const slices = [
    { label: 'Equity', value: data.equity.currentValue },
    { label: 'FD', value: data.fd.totalMaturity },
    { label: 'Gold', value: data.gold.currentValue },
    { label: 'MF', value: data.mf.currentValue },
  ].filter(s => s.value > 0 && total > 0)

  const cx = 45
  const cy = 45
  const r = 40
  const innerR = 22

  let currentDeg = 0
  const paths = slices.map(s => {
    const sweep = (s.value / total) * 360
    const d = arcPath(cx, cy, r, currentDeg, currentDeg + sweep)
    const result = { d, color: COLORS[s.label] ?? '#999' }
    currentDeg += sweep
    return result
  })

  return (
    <Svg width="200" height="90" viewBox="0 0 200 90">
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} />
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill="white" />

      {/* Legend */}
      {slices.map((s, i) => {
        const yBase = 8 + i * 18
        const pct = ((s.value / total) * 100).toFixed(1)
        return (
          <G key={s.label}>
            <Rect x="100" y={yBase} width="8" height="8" fill={COLORS[s.label] ?? '#999'} rx="1" />
            <Text x="112" y={yBase + 7} style={{ fontSize: 8, fill: '#444' }}>
              {s.label} {pct}%
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `AllocationDonut.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/charts/AllocationDonut.tsx
git commit -m "feat(pdf): add AllocationDonut SVG chart for PDF"
```

---

## Task 4: FdByBankBars chart component

**Files:**
- Create: `src/components/pdf/charts/FdByBankBars.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf/charts/FdByBankBars.tsx`:

```typescript
import { Svg, Rect, Text, G } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

interface Props {
  data: PdfData
}

export function FdByBankBars({ data }: Props) {
  const { fdsByBank } = data
  if (fdsByBank.length === 0) return null

  const MAX_BAR_W = 220
  const ROW_H = 14
  const GAP = 6
  const maxTotal = Math.max(...fdsByBank.map(b => b.total))
  const totalFd = fdsByBank.reduce((s, b) => s + b.total, 0)
  const svgH = fdsByBank.length * (ROW_H + GAP)

  return (
    <Svg width="460" height={svgH} viewBox={`0 0 460 ${svgH}`}>
      {fdsByBank.map((bank, i) => {
        const barW = (bank.total / maxTotal) * MAX_BAR_W
        const pct = ((bank.total / totalFd) * 100).toFixed(0)
        const y = i * (ROW_H + GAP)
        return (
          <G key={bank.bankName}>
            {/* Bank name */}
            <Text x="0" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#444' }}>
              {bank.bankName}
            </Text>
            {/* Background track */}
            <Rect x="80" y={y + 2} width={MAX_BAR_W} height={ROW_H - 4} fill="#e8e8ea" rx="2" />
            {/* Filled bar */}
            <Rect x="80" y={y + 2} width={barW} height={ROW_H - 4} fill="#3b82f6" rx="2" />
            {/* Amount */}
            <Text x="310" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#333', fontWeight: 'bold' }}>
              {fmtINRPdf(bank.total)}
            </Text>
            {/* Percent */}
            <Text x="430" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#888' }}>
              {pct}%
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `FdByBankBars.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/charts/FdByBankBars.tsx
git commit -m "feat(pdf): add FdByBankBars SVG chart for PDF"
```

---

## Task 5: TopHoldingsBars chart component

**Files:**
- Create: `src/components/pdf/charts/TopHoldingsBars.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf/charts/TopHoldingsBars.tsx`:

```typescript
import { Svg, Rect, Text, G } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

interface Props {
  data: PdfData
}

export function TopHoldingsBars({ data }: Props) {
  const { holdings } = data
  if (holdings.length === 0) return null

  const MAX_BAR_W = 160
  const ROW_H = 14
  const GAP = 6
  const maxVal = holdings[0].value  // already sorted desc
  const svgH = holdings.length * (ROW_H + GAP)

  return (
    <Svg width="300" height={svgH} viewBox={`0 0 300 ${svgH}`}>
      {holdings.map((h, i) => {
        const barW = (h.value / maxVal) * MAX_BAR_W
        const y = i * (ROW_H + GAP)
        return (
          <G key={h.symbol}>
            <Text x="0" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#444' }}>
              {h.symbol}
            </Text>
            <Rect x="70" y={y + 2} width={MAX_BAR_W} height={ROW_H - 4} fill="#ffe0e5" rx="2" />
            <Rect x="70" y={y + 2} width={barW} height={ROW_H - 4} fill="#ff385c" rx="2" />
            <Text x="240" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#333' }}>
              {fmtINRPdf(h.value)}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `TopHoldingsBars.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/charts/TopHoldingsBars.tsx
git commit -m "feat(pdf): add TopHoldingsBars SVG chart for PDF"
```

---

## Task 6: FdAccrualArea chart component

**Files:**
- Create: `src/components/pdf/charts/FdAccrualArea.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf/charts/FdAccrualArea.tsx`:

```typescript
import { Svg, Path, Text, Line } from '@react-pdf/renderer'
import type { PdfData } from '@/lib/pdf-data'

interface Props {
  data: PdfData
}

const f = (n: number) => n.toFixed(2)

export function FdAccrualArea({ data }: Props) {
  const { timeline } = data
  if (timeline.length === 0) return null

  const W = 300
  const H = 80
  const PAD_TOP = 8

  const maxVal = Math.max(...timeline.flatMap(t => [t.accrued, t.projected]), 1)
  const n = timeline.length

  const xi = (i: number) => (i / (n - 1)) * W
  const yi = (v: number) => H - PAD_TOP - (v / maxVal) * (H - PAD_TOP)

  // Filled area under accrued line
  const areaCoords = timeline.map((t, i) => `${f(xi(i))} ${f(yi(t.accrued))}`).join(' L ')
  const areaPath = `M 0 ${H} L ${areaCoords} L ${f(W)} ${H} Z`

  // Accrued line
  const accruedPath = `M ${timeline.map((t, i) => `${f(xi(i))} ${f(yi(t.accrued))}`).join(' L ')}`

  // Projected line
  const projectedPath = `M ${timeline.map((t, i) => `${f(xi(i))} ${f(yi(t.projected))}`).join(' L ')}`

  return (
    <Svg width={W} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`}>
      {/* Area fill */}
      <Path d={areaPath} fill="#3b82f6" fillOpacity="0.15" />
      {/* Accrued solid line */}
      <Path d={accruedPath} stroke="#3b82f6" strokeWidth="1.5" fill="none" />
      {/* Projected dashed line */}
      <Path d={projectedPath} stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2" fill="none" />
      {/* Baseline */}
      <Line x1="0" y1={H} x2={W} y2={H} stroke="#ddd" strokeWidth="0.5" />
      {/* X-axis labels */}
      <Text x="0" y={H + 12} style={{ fontSize: 7, fill: '#999' }}>Now</Text>
      <Text x={f(W / 2 - 6)} y={H + 12} style={{ fontSize: 7, fill: '#999' }}>12m</Text>
      <Text x={f(W - 16)} y={H + 12} style={{ fontSize: 7, fill: '#999' }}>24m</Text>
    </Svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `FdAccrualArea.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/charts/FdAccrualArea.tsx
git commit -m "feat(pdf): add FdAccrualArea SVG chart for PDF"
```

---

## Task 7: OverviewPdf document component

**Files:**
- Create: `src/components/pdf/OverviewPdf.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf/OverviewPdf.tsx`:

```typescript
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { AllocationDonut } from './charts/AllocationDonut'
import { FdByBankBars } from './charts/FdByBankBars'
import { TopHoldingsBars } from './charts/TopHoldingsBars'
import { FdAccrualArea } from './charts/FdAccrualArea'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#ff385c', paddingBottom: 10, marginBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 9, color: '#666', marginTop: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerValueLabel: { fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  // Stat cards
  cardsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 },
  cardValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  cardSub: { fontSize: 9, marginTop: 2 },
  cardSubPos: { fontSize: 9, marginTop: 2, color: '#16a34a' },
  cardSubNeg: { fontSize: 9, marginTop: 2, color: '#dc2626' },
  cardSubNeu: { fontSize: 9, marginTop: 2, color: '#888' },
  // Sections
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  section: { backgroundColor: '#f7f7f8', borderRadius: 4, padding: 10 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  // MF table
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  rowLabel: { fontSize: 9, color: '#666' },
  rowValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },
  rowValuePos: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  rowValueNeg: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  // Maturities
  maturityItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 8, marginTop: 14 },
  footerText: { fontSize: 8, color: '#aaa' },
})

interface Props {
  data: PdfData
}

function StatCard({ label, value, sub, subType }: {
  label: string
  value: string
  sub: string
  subType: 'positive' | 'negative' | 'neutral'
}) {
  const subStyle = subType === 'positive' ? styles.cardSubPos
    : subType === 'negative' ? styles.cardSubNeg
    : styles.cardSubNeu
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={subStyle}>{sub}</Text>
    </View>
  )
}

export function OverviewPdf({ data }: Props) {
  const dateStr = data.generatedAt.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Portfolio Summary</Text>
            <Text style={styles.headerSub}>Generated {dateStr} · {data.userEmail}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerValueLabel}>Total Value</Text>
            <Text style={styles.headerValue}>{fmtINRPdf(data.totalValue)}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={styles.cardsRow}>
          <StatCard
            label="Equity"
            value={data.equity.currentValue > 0 ? fmtINRPdf(data.equity.currentValue) : '—'}
            sub={data.equity.currentValue > 0 ? `${data.equity.pnlPct >= 0 ? '+' : ''}${data.equity.pnlPct.toFixed(2)}%` : 'Not connected'}
            subType={data.equity.pnlPct >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="FD Corpus"
            value={data.fd.totalMaturity > 0 ? fmtINRPdf(data.fd.totalMaturity) : '—'}
            sub={data.fd.totalMaturity > 0 ? `${data.fd.weightedRate.toFixed(2)}% avg rate` : 'No FDs'}
            subType="neutral"
          />
          <StatCard
            label="Gold"
            value={data.gold.currentValue > 0 ? fmtINRPdf(data.gold.currentValue) : '—'}
            sub={data.gold.gainLossPct != null ? `${data.gold.gainLossPct >= 0 ? '+' : ''}${data.gold.gainLossPct.toFixed(1)}%` : '—'}
            subType={data.gold.gainLossPct != null ? (data.gold.gainLossPct >= 0 ? 'positive' : 'negative') : 'neutral'}
          />
          <StatCard
            label="Portfolio CAGR"
            value={data.cagr !== 0 ? `${data.cagr.toFixed(2)}%` : '—'}
            sub="annualised"
            subType={data.cagr > 0 ? 'positive' : 'neutral'}
          />
        </View>

        {/* Allocation + MF/Maturities */}
        <View style={styles.twoCol}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>Asset Allocation</Text>
            <AllocationDonut data={data} />
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>Mutual Funds</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Invested</Text>
              <Text style={styles.rowValue}>{fmtINRPdf(data.mf.totalInvested)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Current Value</Text>
              <Text style={styles.rowValue}>{fmtINRPdf(data.mf.currentValue)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>P&L</Text>
              <Text style={data.mf.totalPnL >= 0 ? styles.rowValuePos : styles.rowValueNeg}>
                {data.mf.totalPnL >= 0 ? '+' : ''}{fmtINRPdf(data.mf.totalPnL)}
              </Text>
            </View>
            {data.upcomingMaturities.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>Upcoming Maturities</Text>
                {data.upcomingMaturities.map((m, i) => (
                  <View key={i} style={styles.maturityItem}>
                    <Text style={{ fontSize: 8, color: '#444' }}>{m.bankName}</Text>
                    <Text style={{ fontSize: 8, color: '#444' }}>{fmtINRPdf(m.amount)} · {m.daysRemaining}d</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* FD by Bank */}
        {data.fdsByBank.length > 0 && (
          <View style={[styles.section, { marginBottom: 14 }]}>
            <Text style={styles.sectionLabel}>FD Corpus by Bank</Text>
            <FdByBankBars data={data} />
          </View>
        )}

        {/* Top Holdings + FD Accrual */}
        <View style={styles.twoCol}>
          {data.holdings.length > 0 && (
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionLabel}>Top Holdings</Text>
              <TopHoldingsBars data={data} />
            </View>
          )}
          {data.timeline.length > 0 && (
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionLabel}>FD Interest Accrual (24 mo)</Text>
              <FdAccrualArea data={data} />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Personal Investment Tracker</Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `OverviewPdf.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/OverviewPdf.tsx
git commit -m "feat(pdf): add OverviewPdf document component"
```

---

## Task 8: generate-overview-pdf trigger

**Files:**
- Create: `src/lib/generate-overview-pdf.tsx`

- [ ] **Step 1: Create the file**

Create `src/lib/generate-overview-pdf.tsx`:

```typescript
import type { PdfData } from './pdf-data'

export async function generateOverviewPdf(data: PdfData): Promise<void> {
  const [{ pdf }, { OverviewPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/OverviewPdf'),
  ])
  const blob = await pdf(<OverviewPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to `generate-overview-pdf.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generate-overview-pdf.tsx
git commit -m "feat(pdf): add generateOverviewPdf trigger function"
```

---

## Task 9: Server-side data — add fdsByBank and userEmail

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update page.tsx**

In `src/app/dashboard/page.tsx`, make these changes:

1. In `getData()`, compute `fdsByBank` from `fdRecords` and include it in the return value.
2. In `OverviewPage`, get `userEmail` from `getSessionUserId()` (it already returns the email).
3. Pass both to `OverviewClient`.

The full updated file:

```typescript
import { prisma } from "@/lib/prisma";
import { portfolioSummary, fdAccrualTimeline, type Holding, type MFHolding, type FDRecord } from "@/lib/analytics";
import { OverviewClient } from "./overview-client";
import { getSessionUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

async function getData(userId: string | null) {
  const [fds, kiteConfig, snapshot] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where: { userId: userId ?? "" },
      orderBy: { maturityDate: "asc" },
      include: { renewals: { orderBy: { renewalNumber: "asc" } } },
    }),
    userId ? prisma.kiteConfig.findUnique({ where: { userId } }) : null,
    userId ? prisma.kiteSnapshot.findUnique({ where: { userId } }) : null,
  ]);

  const holdings: Holding[] = snapshot ? JSON.parse(snapshot.holdingsJson) : [];
  const mfHoldings: MFHolding[] = snapshot ? JSON.parse(snapshot.mfHoldingsJson) : [];

  const fdRecords: FDRecord[] = fds.map((fd) => {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      id: fd.id,
      bankName: fd.bankName,
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      tenureDays: latest?.tenureDays ?? fd.tenureDays,
      tenureText: latest?.tenureText ?? fd.tenureText,
      startDate: latest?.startDate ?? fd.startDate,
      maturityDate: latest?.maturityDate ?? fd.maturityDate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
      interestType: fd.interestType,
      compoundFreq: fd.compoundFreq ?? null,
    };
  });

  const summary = portfolioSummary(holdings, fdRecords, mfHoldings);
  const timeline = fdAccrualTimeline(fdRecords, 24);
  const now = new Date();
  const upcomingMaturities = fdRecords.filter((fd) => {
    const d = new Date(fd.maturityDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const fdsByBankMap = fdRecords.reduce<Record<string, number>>((acc, fd) => {
    acc[fd.bankName] = (acc[fd.bankName] ?? 0) + fd.principal;
    return acc;
  }, {});
  const fdsByBank = Object.entries(fdsByBankMap)
    .map(([bankName, total]) => ({ bankName, total }))
    .sort((a, b) => b.total - a.total);

  return {
    summary,
    timeline,
    holdings,
    mfHoldings,
    upcomingMaturities,
    kiteConnected: !!kiteConfig?.accessToken,
    fdsByBank,
  };
}

async function getGoldTotals(userId: string | null) {
  const [goldItems, goldRate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId: userId ?? "", disabled: false } }),
    getTodaysRate(),
  ]);
  let currentValue = 0;
  let invested = 0;
  for (const it of goldItems) {
    if (goldRate) currentValue += valuePerGram(it.karat, goldRate.rate22kPerG, goldRate.rate24kPerG) * it.weightGrams;
    if (it.purchasePrice != null) invested += it.purchasePrice;
  }
  return {
    count: goldItems.length,
    currentValue,
    invested,
    gainLoss: invested > 0 && goldRate ? currentValue - invested : null,
    hasRate: !!goldRate,
  };
}

export default async function OverviewPage() {
  const userId = await getSessionUserId();
  const [{ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected, fdsByBank }, goldTotals] =
    await Promise.all([getData(userId), getGoldTotals(userId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Overview</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Your complete investment portfolio at a glance.</p>
      </div>
      <OverviewClient
        summary={summary}
        timeline={timeline}
        holdings={holdings}
        mfHoldings={mfHoldings}
        upcomingMaturities={upcomingMaturities}
        kiteConnected={kiteConnected}
        goldTotals={goldTotals}
        fdsByBank={fdsByBank}
        userEmail={userId ?? ""}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Errors about `fdsByBank` and `userEmail` not existing on `OverviewClient` Props — this is expected and will be fixed in Task 10.

- [ ] **Step 3: Do NOT commit yet** — page.tsx depends on Task 10's Props update.

---

## Task 10: Wire Print button in OverviewClient

**Files:**
- Modify: `src/app/dashboard/overview-client.tsx`

- [ ] **Step 1: Update overview-client.tsx**

Make the following changes to `src/app/dashboard/overview-client.tsx`:

1. Add `fdsByBank` and `userEmail` to the `Props` interface.
2. Add a `printing` state and `handlePrint` async handler.
3. Add the Print button to the header row (before the existing `<div className="space-y-6">`).
4. Import `Printer` and `Loader2` from `lucide-react`, `useState` from `react`, `buildPdfData` and `generateOverviewPdf`.

Replace the file with:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, ArrowRight, Wallet, BarChart2, PiggyBank, Activity, Coins, Printer, Loader2, type LucideIcon } from "lucide-react";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { InterestAccrualChart } from "@/components/charts/interest-accrual-chart";
import { TopHoldingsChart } from "@/components/charts/top-holdings-chart";
import { WealthProjectionChart } from "@/components/charts/wealth-projection-chart";
import { formatINR, formatINRCompact, formatPercent, formatDate, daysUntil } from "@/lib/format";
import { buildPdfData } from "@/lib/pdf-data";
import { generateOverviewPdf } from "@/lib/generate-overview-pdf";
import { cn } from "@/lib/utils";
import type { Holding, MFHolding, FDRecord } from "@/lib/analytics";

interface Props {
  summary: {
    totalCapital: number;
    totalValue: number;
    cagr: number;
    equityPct: number;
    fdPct: number;
    mfPct: number;
    equity: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number };
    fd: { totalPrincipal: number; totalMaturity: number; totalInterest: number; interestThisYear: number; weightedRate: number };
    mf: { totalInvested: number; currentValue: number; totalPnL: number; totalPnLPct: number };
  };
  timeline: { month: string; accrued: number; projected: number }[];
  holdings: Holding[];
  mfHoldings: MFHolding[];
  upcomingMaturities: FDRecord[];
  kiteConnected: boolean;
  goldTotals: {
    count: number;
    currentValue: number;
    invested: number;
    gainLoss: number | null;
    hasRate: boolean;
  };
  fdsByBank: { bankName: string; total: number }[];
  userEmail: string;
}

function StatCard({
  label, value, sub, positive, Icon,
}: {
  label: string; value: string; sub?: string; positive?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <div className="ab-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
        {Icon && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c20] text-[#ededed]">
            <Icon size={15} strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mono text-[22px] font-bold text-[#ededed] leading-tight">{value}</p>
      {sub && (
        <p className={cn(
          "text-[12px] flex items-center gap-1 mt-1.5 font-medium",
          positive === true ? "text-[#5ee0a4]" : positive === false ? "text-[#ff7a6e]" : "text-[#a0a0a5]"
        )}>
          {positive === true && <TrendingUp size={12} />}
          {positive === false && <TrendingDown size={12} />}
          {sub}
        </p>
      )}
    </div>
  );
}

export function OverviewClient({ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected, goldTotals, fdsByBank, userEmail }: Props) {
  const [printing, setPrinting] = useState(false);
  const { equity, fd, mf } = summary;
  const hasEquity = holdings.length > 0;
  const hasMF = mfHoldings.length > 0;
  const hasFD = fd.totalPrincipal > 0;
  const hasGold = goldTotals.count > 0;
  const hasAny = hasEquity || hasFD || hasMF || hasGold;

  const allocationTotal = summary.totalValue + goldTotals.currentValue;
  const allocationPct = (v: number) => (allocationTotal > 0 ? (v / allocationTotal) * 100 : 0);

  async function handlePrint() {
    setPrinting(true);
    try {
      const data = buildPdfData(
        { summary, timeline, holdings, mfHoldings, goldTotals, upcomingMaturities, fdsByBank },
        userEmail,
      );
      await generateOverviewPdf(data);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setPrinting(false);
    }
  }

  if (!hasAny) {
    return (
      <div className="ab-card p-10 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-5">
          <Landmark size={22} className="text-[#ff385c]" />
        </div>
        <p className="text-[20px] font-semibold text-[#ededed] tracking-tight">No investments tracked yet</p>
        <p className="text-[14px] text-[#a0a0a5] mt-2 mb-6">Connect Zerodha or add a Fixed Deposit to get started.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/dashboard/settings" className="ab-btn ab-btn-accent">
            Connect Zerodha
          </Link>
          <Link href="/dashboard/fd/new" className="ab-btn ab-btn-secondary">
            Add FD
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handlePrint}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2e] bg-[#17171a] text-[#ededed] text-[13px] font-medium hover:bg-[#1c1c20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          {printing ? "Generating…" : "Print PDF"}
        </button>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Portfolio"
          value={formatINR(summary.totalValue)}
          sub={`Capital ${formatINR(summary.totalCapital)}`}
          Icon={Wallet}
        />
        <StatCard
          label="Equity Value"
          value={hasEquity ? formatINR(equity.currentValue) : "—"}
          sub={hasEquity ? `${formatPercent(equity.totalPnLPct)} overall` : "Not connected"}
          positive={hasEquity ? equity.totalPnL >= 0 : undefined}
          Icon={BarChart2}
        />
        <StatCard
          label="FD Corpus"
          value={hasFD ? formatINR(fd.totalMaturity) : "—"}
          sub={hasFD ? `${fd.weightedRate.toFixed(2)}% avg rate` : "No FDs added"}
          Icon={PiggyBank}
        />
        <Link href="/dashboard/gold" className="block hover:brightness-110 transition">
          <StatCard
            label="Gold"
            value={hasGold && goldTotals.hasRate ? formatINR(goldTotals.currentValue) : hasGold ? "—" : "—"}
            sub={hasGold
              ? (goldTotals.gainLoss != null
                ? `${goldTotals.count} items · ${goldTotals.gainLoss >= 0 ? "+" : ""}${formatINR(goldTotals.gainLoss)}`
                : `${goldTotals.count} items`)
              : "No jewellery added"}
            positive={goldTotals.gainLoss != null ? goldTotals.gainLoss >= 0 : undefined}
            Icon={Coins}
          />
        </Link>
        <StatCard
          label="Portfolio CAGR"
          value={summary.cagr !== 0 ? `${summary.cagr.toFixed(2)}%` : "—"}
          sub={summary.cagr !== 0 ? "annualised return" : "Add more data"}
          positive={summary.cagr > 0 ? true : summary.cagr < 0 ? false : undefined}
          Icon={Activity}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">

          <div className="ab-card p-6">
            <h2 className="text-[18px] font-semibold text-[#ededed] mb-5 tracking-tight">Asset Allocation</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="shrink-0 w-[168px] h-[168px]">
                <AllocationDonut
                  equityValue={equity.currentValue}
                  fdValue={fd.totalMaturity}
                  mfValue={mf.currentValue}
                  goldValue={goldTotals.currentValue}
                  centerLabel="Total"
                  centerValue={formatINRCompact(allocationTotal)}
                />
              </div>
              <div className="flex-1 min-w-[260px] space-y-4">
                {[
                  { label: "Equity", sub: "Zerodha stocks", value: formatINR(equity.currentValue), pct: allocationPct(equity.currentValue), color: "#ff385c" },
                  { label: "Mutual Funds", sub: "Direct MF", value: formatINR(mf.currentValue), pct: allocationPct(mf.currentValue), color: "#5aa9ff" },
                  { label: "Fixed Deposits", sub: "FDs + SGBs", value: formatINR(fd.totalMaturity), pct: allocationPct(fd.totalMaturity), color: "#5ee0a4" },
                  { label: "Gold", sub: "Jewellery (IBJA rate)", value: formatINR(goldTotals.currentValue), pct: allocationPct(goldTotals.currentValue), color: "#f5a524" },
                ].filter((r) => r.pct > 0).map(({ label, sub, value, pct, color }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#ededed]">{label}</p>
                        <p className="text-[12px] text-[#a0a0a5]">{sub}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="mono text-[14px] font-semibold text-[#ededed]">{pct.toFixed(1)}%</p>
                        <p className="mono text-[12px] text-[#a0a0a5]">{value}</p>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-[#222226] overflow-hidden ml-5">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {hasMF && (
            <div className="ab-card p-6">
              <h3 className="text-[16px] font-semibold text-[#ededed] mb-4 tracking-tight">Mutual Funds</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { label: "Invested", value: formatINR(mf.totalInvested), cls: "text-[#ededed]" },
                  { label: "Current Value", value: formatINR(mf.currentValue), cls: "text-[#ededed]" },
                  { label: "Total P&L", value: (mf.totalPnL >= 0 ? "+" : "") + formatINR(mf.totalPnL), cls: mf.totalPnL >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
                    <p className={cn("mono text-[20px] font-semibold mt-1", cls)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.cagr > 0 && (
            <div className="ab-card p-6">
              <h3 className="text-[18px] font-semibold text-[#ededed] mb-4 tracking-tight">Wealth Projection</h3>
              <WealthProjectionChart currentValue={summary.totalValue} cagr={summary.cagr} />
            </div>
          )}

          {hasFD && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-[18px] font-semibold text-[#ededed] tracking-tight">FD Interest Accrual</h3>
                <div className="flex items-center gap-4 text-[12px] text-[#a0a0a5]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] bg-[#ff385c] inline-block" /> Accrued</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] border-t border-dashed border-[#ff385c] inline-block" /> Projected</span>
                </div>
              </div>
              <InterestAccrualChart data={timeline} />
            </div>
          )}

          {hasEquity && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[18px] font-semibold text-[#ededed] tracking-tight">Top Holdings</h3>
                <Link href="/dashboard/zerodha" className="text-[13px] text-[#ededed] font-semibold underline underline-offset-4 flex items-center gap-1 hover:text-[#ff385c] transition-colors">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <TopHoldingsChart holdings={holdings} />
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-5">
          {hasFD && (
            <div className="space-y-3">
              {[
                { label: "Interest This Year", value: formatINR(fd.interestThisYear), cls: "text-[#ededed]" },
                { label: "Total FD Interest", value: formatINR(fd.totalInterest), cls: "text-[#ededed]" },
                { label: "Equity P&L", value: (equity.totalPnL >= 0 ? "+" : "") + formatINR(equity.totalPnL), cls: equity.totalPnL >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="ab-card-flat p-4 flex items-center justify-between">
                  <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
                  <p className={cn("mono font-semibold text-[15px]", cls)}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {hasFD && upcomingMaturities.length > 0 && (
            <div className="ab-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Upcoming Maturities</h3>
                <Link href="/dashboard/fd" className="text-[12px] text-[#ededed] font-semibold underline underline-offset-4 flex items-center gap-1 hover:text-[#ff385c] transition-colors">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              <div className="divide-y divide-[#2a2a2e]">
                {upcomingMaturities.map((fd) => {
                  const days = daysUntil(fd.maturityDate);
                  return (
                    <div key={fd.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[14px] font-semibold text-[#ededed]">{fd.bankName}</p>
                        <p className="text-[12px] text-[#a0a0a5] mt-0.5">{formatDate(fd.maturityDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="mono text-[14px] font-semibold text-[#ededed]">{formatINR(fd.maturityAmount ?? fd.principal)}</p>
                        <p className={cn(
                          "text-[11px] font-semibold flex items-center gap-0.5 justify-end mt-0.5",
                          days <= 7 ? "text-[#ff7a6e]" : days <= 30 ? "text-[#f5a524]" : "text-[#a0a0a5]"
                        )}>
                          {days <= 30 && <AlertTriangle size={10} />}
                          {days}d remaining
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasEquity && !kiteConnected && (
            <div className="ab-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-[#ff385c]" />
              </div>
              <p className="text-[16px] font-semibold text-[#ededed] tracking-tight">Connect Zerodha</p>
              <p className="text-[13px] text-[#a0a0a5] mt-1 mb-4">Link your Kite account to see equity holdings.</p>
              <Link href="/dashboard/settings" className="ab-btn ab-btn-accent inline-flex">
                Go to Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass (including `pdf-data.test.ts`).

- [ ] **Step 4: Commit everything**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/overview-client.tsx
git commit -m "feat(pdf): wire Print PDF button on overview page"
```

---

## Done

After Task 10, the Print PDF button is live. Clicking it:
1. Calls `buildPdfData()` to assemble `PdfData` from the existing client-side props
2. Dynamically imports `@react-pdf/renderer` and `OverviewPdf` (avoids SSR issues)
3. Renders the PDF to a `Blob` and opens it in a new tab via `URL.createObjectURL`
