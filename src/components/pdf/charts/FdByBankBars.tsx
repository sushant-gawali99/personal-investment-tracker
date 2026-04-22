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
            <Text x="0" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#444' }}>
              {bank.bankName}
            </Text>
            <Rect x="80" y={y + 2} width={MAX_BAR_W} height={ROW_H - 4} fill="#e8e8ea" rx="2" />
            <Rect x="80" y={y + 2} width={barW} height={ROW_H - 4} fill="#3b82f6" rx="2" />
            <Text x="310" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#333', fontWeight: 'bold' }}>
              {fmtINRPdf(bank.total)}
            </Text>
            <Text x="430" y={y + ROW_H - 3} style={{ fontSize: 8, fill: '#888' }}>
              {pct}%
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
