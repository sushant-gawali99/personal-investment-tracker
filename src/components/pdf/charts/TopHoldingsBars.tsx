import { Svg, Rect, Text, G } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

interface Props {
  data: PdfData
}

export function TopHoldingsBars({ data }: Props) {
  const { holdings } = data
  if (holdings.length === 0) return null

  const MAX_BAR_W = 220
  const ROW_H = 12
  const GAP = 4
  const maxVal = holdings[0].value  // already sorted desc
  const svgH = holdings.length * (ROW_H + GAP)

  return (
    <Svg width="420" height={svgH} viewBox={`0 0 420 ${svgH}`}>
      {holdings.map((h, i) => {
        const barW = (h.value / maxVal) * MAX_BAR_W
        const y = i * (ROW_H + GAP)
        return (
          <G key={h.symbol}>
            <Text x="0" y={y + ROW_H - 4} style={{ fontSize: 9, fill: '#444' }}>
              {h.symbol}
            </Text>
            <Rect x="100" y={y + 2} width={MAX_BAR_W} height={ROW_H - 4} fill="#ffe0e5" rx="2" />
            <Rect x="100" y={y + 2} width={barW} height={ROW_H - 4} fill="#ff385c" rx="2" />
            <Text x="345" y={y + ROW_H - 4} style={{ fontSize: 9, fill: '#333' }}>
              {fmtINRPdf(h.value)}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}
