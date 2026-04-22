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
