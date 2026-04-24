import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'

export interface NJIndiaPdfData {
  generatedAt: Date
  investorName: string | null
  reportDate: string | null
  summary: {
    totalInvested: number
    totalCurrentValue: number
    totalGainLoss: number
    xirrPct: number | null
    absoluteReturnPct: number | null
    schemeCount: number
  }
  schemes: Array<{
    scheme: string
    subType: string
    invested: number
    units: number
    currentValue: number
    annualizedReturnPct: number | null
    absoluteReturnPct: number | null
    holdingPct: number
    tenure: string
  }>
}

const S = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#8b5cf6', paddingBottom: 8, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 8, color: '#666', marginTop: 2 },
  headerValueLabel: { fontSize: 8, color: '#999' },
  headerValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  // Stat cards
  cardsRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 7 },
  cardLabel: { fontSize: 7, color: '#888' },
  cardValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  cardSubPos: { fontSize: 7, marginTop: 2, color: '#16a34a' },
  cardSubNeg: { fontSize: 7, marginTop: 2, color: '#dc2626' },
  cardSubNeu: { fontSize: 7, marginTop: 2, color: '#888' },
  // Section
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 5 },
  // Table
  tableHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 4, borderRadius: 2, marginBottom: 1 },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#555' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fbfbfc' },
  cell: { fontSize: 7, color: '#333' },
  cellBold: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#111' },
  cellPos: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  cellNeg: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  cellMuted: { fontSize: 6.5, color: '#888' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 12 },
  footerText: { fontSize: 7, color: '#aaa' },
})

export function NJIndiaPdf({ data }: { data: NJIndiaPdfData }) {
  const { summary, schemes } = data

  const pnlPct = summary.totalInvested > 0
    ? (summary.totalGainLoss / summary.totalInvested) * 100
    : 0
  const gain = summary.totalGainLoss >= 0

  const generatedStr = data.generatedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const reportStr = data.reportDate
    ? new Date(data.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : generatedStr

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Mutual Funds — NJ India</Text>
            <Text style={S.headerSub}>As on {reportStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.headerValueLabel}>Current Value</Text>
            <Text style={S.headerValue}>{fmtINRPdf(summary.totalCurrentValue)}</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={S.cardsRow}>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Invested</Text>
            <Text style={S.cardValue}>{fmtINRPdf(summary.totalInvested)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Current Value</Text>
            <Text style={S.cardValue}>{fmtINRPdf(summary.totalCurrentValue)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Gain / Loss</Text>
            <Text style={[S.cardValue, { color: gain ? '#16a34a' : '#dc2626' }]}>
              {gain ? '+' : ''}{fmtINRPdf(summary.totalGainLoss)}
            </Text>
            <Text style={gain ? S.cardSubPos : S.cardSubNeg}>
              {gain ? '+' : ''}{pnlPct.toFixed(2)}%
            </Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>XIRR</Text>
            <Text style={[S.cardValue, { color: (summary.xirrPct ?? 0) >= 0 ? '#16a34a' : '#dc2626' }]}>
              {summary.xirrPct != null ? `${summary.xirrPct.toFixed(2)}%` : '—'}
            </Text>
            {summary.absoluteReturnPct != null && (
              <Text style={S.cardSubNeu}>{summary.absoluteReturnPct.toFixed(1)}% abs</Text>
            )}
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Schemes</Text>
            <Text style={S.cardValue}>{summary.schemeCount}</Text>
            <Text style={S.cardSubNeu}>funds</Text>
          </View>
        </View>

        {/* Schemes table */}
        <Text style={[S.sectionTitle, { marginBottom: 6 }]}>
          Scheme-wise Holdings ({schemes.length})
        </Text>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 3.5 }]}>Scheme</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2 }]}>Type</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Invested</Text>
          <Text style={[S.tableHeadCell, { flex: 0.8, textAlign: 'right' }]}>Units</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Value</Text>
          <Text style={[S.tableHeadCell, { flex: 1.1, textAlign: 'right' }]}>Gain</Text>
          <Text style={[S.tableHeadCell, { flex: 0.7, textAlign: 'right' }]}>XIRR</Text>
          <Text style={[S.tableHeadCell, { flex: 0.6, textAlign: 'right' }]}>Wt%</Text>
        </View>

        {schemes.map((s, i) => {
          const gain = s.currentValue - s.invested
          const isAlt = i % 2 === 1
          return (
            <View key={i} style={isAlt ? S.tableRowAlt : S.tableRow} wrap={false}>
              <Text style={[S.cellBold, { flex: 3.5 }]}>{s.scheme}</Text>
              <Text style={[S.cellMuted, { flex: 1.2 }]}>{s.subType}</Text>
              <Text style={[S.cell, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(s.invested)}</Text>
              <Text style={[S.cell, { flex: 0.8, textAlign: 'right' }]}>{s.units.toFixed(3)}</Text>
              <Text style={[S.cellBold, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(s.currentValue)}</Text>
              <Text style={[gain >= 0 ? S.cellPos : S.cellNeg, { flex: 1.1, textAlign: 'right' }]}>
                {gain >= 0 ? '+' : ''}{fmtINRPdf(gain)}
              </Text>
              <Text style={[
                s.annualizedReturnPct != null && s.annualizedReturnPct >= 0 ? S.cellPos : S.cellNeg,
                { flex: 0.7, textAlign: 'right' }
              ]}>
                {s.annualizedReturnPct != null ? `${s.annualizedReturnPct.toFixed(1)}%` : '—'}
              </Text>
              <Text style={[S.cell, { flex: 0.6, textAlign: 'right' }]}>
                {s.holdingPct.toFixed(1)}%
              </Text>
            </View>
          )
        })}

        {/* Totals row */}
        <View style={[S.tableRow, { backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 1 }]} wrap={false}>
          <Text style={[S.cellBold, { flex: 3.5 }]}>Total</Text>
          <Text style={[S.cell, { flex: 1.2 }]} />
          <Text style={[S.cellBold, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(summary.totalInvested)}</Text>
          <Text style={[S.cell, { flex: 0.8 }]} />
          <Text style={[S.cellBold, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(summary.totalCurrentValue)}</Text>
          <Text style={[gain ? S.cellPos : S.cellNeg, { flex: 1.1, textAlign: 'right' }]}>
            {gain ? '+' : ''}{fmtINRPdf(summary.totalGainLoss)}
          </Text>
          <Text style={[S.cellBold, { flex: 0.7, textAlign: 'right' }]}>
            {summary.xirrPct != null ? `${summary.xirrPct.toFixed(1)}%` : '—'}
          </Text>
          <Text style={[S.cellBold, { flex: 0.6, textAlign: 'right' }]}>100%</Text>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Personal Investment Tracker · NJ India</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
