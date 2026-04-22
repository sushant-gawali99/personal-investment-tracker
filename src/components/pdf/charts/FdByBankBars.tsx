import { View, Text } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

interface Props {
  data: PdfData
}

function firstTwoWords(s: string) {
  return s.split(/\s+/).slice(0, 2).join(' ')
}

export function FdByBankBars({ data }: Props) {
  const { fdsByBank } = data
  if (fdsByBank.length === 0) return null

  const maxTotal = Math.max(...fdsByBank.map(b => b.total))
  const totalFd = fdsByBank.reduce((s, b) => s + b.total, 0)

  return (
    <View>
      {fdsByBank.map((bank) => {
        const pct = ((bank.total / totalFd) * 100).toFixed(0)
        const barPct = (bank.total / maxTotal) * 100
        return (
          <View key={bank.bankName} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 8, color: '#444', width: 110 }}>
              {firstTwoWords(bank.bankName)}
            </Text>
            <View style={{ flex: 1, height: 8, backgroundColor: '#e8e8ea', borderRadius: 2, marginLeft: 6, marginRight: 8 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <View style={{ width: `${barPct}%` as any, height: 8, backgroundColor: '#3b82f6', borderRadius: 2 }} />
            </View>
            <Text style={{ fontSize: 8, color: '#333', fontFamily: 'Helvetica-Bold', width: 72 }}>
              {fmtINRPdf(bank.total)}
            </Text>
            <Text style={{ fontSize: 8, color: '#888', width: 28, textAlign: 'right' }}>
              {pct}%
            </Text>
          </View>
        )
      })}
    </View>
  )
}
