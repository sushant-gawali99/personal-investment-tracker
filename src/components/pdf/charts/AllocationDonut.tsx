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
