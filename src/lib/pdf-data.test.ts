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
