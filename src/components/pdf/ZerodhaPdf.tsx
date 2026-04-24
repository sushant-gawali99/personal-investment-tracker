import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'

export interface ZerodhaPdfData {
  generatedAt: Date
  holdings: Array<{
    tradingsymbol: string
    quantity: number
    average_price: number
    last_price: number
    day_change?: number
  }>
  mfHoldings: Array<{
    fund: string
    quantity: number
    average_price: number
    last_price: number
  }>
}

const S = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#ff385c', paddingBottom: 8, marginBottom: 12 },
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
  cell: { fontSize: 7.5, color: '#333' },
  cellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111' },
  cellPos: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  cellNeg: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 12 },
  footerText: { fontSize: 7, color: '#aaa' },
})

export function ZerodhaPdf({ data }: { data: ZerodhaPdfData }) {
  const { holdings, mfHoldings } = data

  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0)
  const currentValue = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0)
  const totalPnL = currentValue - totalInvested
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const dayPnL = holdings.reduce((s, h) => s + (h.day_change ?? 0) * h.quantity, 0)

  const mfInvested = mfHoldings.reduce((s, h) => s + h.average_price * h.quantity, 0)
  const mfValue = mfHoldings.reduce((s, h) => s + h.last_price * h.quantity, 0)
  const mfPnL = mfValue - mfInvested

  const dateStr = data.generatedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const sortedHoldings = [...holdings].sort((a, b) => (b.last_price * b.quantity) - (a.last_price * a.quantity))
  const sortedMF = [...mfHoldings].sort((a, b) => (b.last_price * b.quantity) - (a.last_price * a.quantity))

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Zerodha Holdings</Text>
            <Text style={S.headerSub}>Generated {dateStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.headerValueLabel}>Current Value</Text>
            <Text style={S.headerValue}>{fmtINRPdf(currentValue)}</Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={S.cardsRow}>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Invested</Text>
            <Text style={S.cardValue}>{fmtINRPdf(totalInvested)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Current Value</Text>
            <Text style={S.cardValue}>{fmtINRPdf(currentValue)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Overall P&L</Text>
            <Text style={[S.cardValue, { color: totalPnL >= 0 ? '#16a34a' : '#dc2626' }]}>
              {totalPnL >= 0 ? '+' : ''}{fmtINRPdf(totalPnL)}
            </Text>
            <Text style={totalPnL >= 0 ? S.cardSubPos : S.cardSubNeg}>
              {totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
            </Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Day's Change</Text>
            <Text style={[S.cardValue, { color: dayPnL >= 0 ? '#16a34a' : '#dc2626' }]}>
              {dayPnL >= 0 ? '+' : ''}{fmtINRPdf(dayPnL)}
            </Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Holdings</Text>
            <Text style={S.cardValue}>{holdings.length}</Text>
            <Text style={S.cardSubNeu}>stocks</Text>
          </View>
        </View>

        {/* Equity Holdings table */}
        <Text style={[S.sectionTitle, { marginBottom: 6 }]}>Equity Holdings ({holdings.length})</Text>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 2.5 }]}>Symbol</Text>
          <Text style={[S.tableHeadCell, { flex: 0.7, textAlign: 'right' }]}>Qty</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Avg Cost</Text>
          <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>Invested</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>LTP</Text>
          <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>Value</Text>
          <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>P&L</Text>
        </View>
        {sortedHoldings.map((h) => {
          const invested = h.average_price * h.quantity
          const value = h.last_price * h.quantity
          const pnl = value - invested
          return (
            <View key={h.tradingsymbol} style={S.tableRow} wrap={false}>
              <Text style={[S.cellBold, { flex: 2.5 }]}>{h.tradingsymbol}</Text>
              <Text style={[S.cell, { flex: 0.7, textAlign: 'right' }]}>{h.quantity}</Text>
              <Text style={[S.cell, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(h.average_price)}</Text>
              <Text style={[S.cell, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(invested)}</Text>
              <Text style={[S.cell, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(h.last_price)}</Text>
              <Text style={[S.cellBold, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(value)}</Text>
              <Text style={[pnl >= 0 ? S.cellPos : S.cellNeg, { flex: 1.3, textAlign: 'right' }]}>
                {pnl >= 0 ? '+' : ''}{fmtINRPdf(pnl)}
              </Text>
            </View>
          )
        })}

        {/* Totals row */}
        <View style={[S.tableRow, { backgroundColor: '#f7f7f8', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 1 }]} wrap={false}>
          <Text style={[S.cellBold, { flex: 2.5 }]}>Total</Text>
          <Text style={[S.cell, { flex: 0.7 }]} />
          <Text style={[S.cell, { flex: 1.2 }]} />
          <Text style={[S.cellBold, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(totalInvested)}</Text>
          <Text style={[S.cell, { flex: 1.2 }]} />
          <Text style={[S.cellBold, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(currentValue)}</Text>
          <Text style={[totalPnL >= 0 ? S.cellPos : S.cellNeg, { flex: 1.3, textAlign: 'right' }]}>
            {totalPnL >= 0 ? '+' : ''}{fmtINRPdf(totalPnL)}
          </Text>
        </View>

        {/* MF Holdings */}
        {mfHoldings.length > 0 && (
          <>
            <Text style={[S.sectionTitle, { marginTop: 16, marginBottom: 6 }]}>
              Mutual Funds — Zerodha ({mfHoldings.length})
            </Text>
            <View style={S.cardsRow}>
              <View style={S.card}>
                <Text style={S.cardLabel}>MF Invested</Text>
                <Text style={S.cardValue}>{fmtINRPdf(mfInvested)}</Text>
              </View>
              <View style={S.card}>
                <Text style={S.cardLabel}>MF Value</Text>
                <Text style={S.cardValue}>{fmtINRPdf(mfValue)}</Text>
              </View>
              <View style={S.card}>
                <Text style={S.cardLabel}>MF P&L</Text>
                <Text style={[S.cardValue, { color: mfPnL >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {mfPnL >= 0 ? '+' : ''}{fmtINRPdf(mfPnL)}
                </Text>
              </View>
            </View>
            <View style={S.tableHead}>
              <Text style={[S.tableHeadCell, { flex: 3.5 }]}>Fund</Text>
              <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'right' }]}>Units</Text>
              <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Avg NAV</Text>
              <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>Invested</Text>
              <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>NAV</Text>
              <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>Value</Text>
              <Text style={[S.tableHeadCell, { flex: 1.3, textAlign: 'right' }]}>P&L</Text>
            </View>
            {sortedMF.map((h, i) => {
              const invested = h.average_price * h.quantity
              const value = h.last_price * h.quantity
              const pnl = value - invested
              return (
                <View key={i} style={S.tableRow} wrap={false}>
                  <Text style={[S.cellBold, { flex: 3.5 }]}>{h.fund}</Text>
                  <Text style={[S.cell, { flex: 1, textAlign: 'right' }]}>{h.quantity.toFixed(3)}</Text>
                  <Text style={[S.cell, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(h.average_price)}</Text>
                  <Text style={[S.cell, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(invested)}</Text>
                  <Text style={[S.cell, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(h.last_price)}</Text>
                  <Text style={[S.cellBold, { flex: 1.3, textAlign: 'right' }]}>{fmtINRPdf(value)}</Text>
                  <Text style={[pnl >= 0 ? S.cellPos : S.cellNeg, { flex: 1.3, textAlign: 'right' }]}>
                    {pnl >= 0 ? '+' : ''}{fmtINRPdf(pnl)}
                  </Text>
                </View>
              )
            })}
          </>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Personal Investment Tracker · Zerodha</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
