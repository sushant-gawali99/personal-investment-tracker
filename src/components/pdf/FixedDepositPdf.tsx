import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'

export interface FDPdfData {
  generatedAt: Date
  stats: {
    totalPrincipal: number
    totalMaturity: number
    totalInterest: number
    activeFDs: number
    avgRate: number
    interestThisYear: number
  }
  fds: Array<{
    bankName: string
    branchName: string | null
    fdNumber: string | null
    principal: number
    interestRate: number
    tenureText: string | null
    tenureMonths: number
    tenureDays: number
    startDate: string
    maturityDate: string
    maturityAmount: number | null
    isMatured: boolean
    disabled: boolean
  }>
}

const S = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#5ee0a4', paddingBottom: 8, marginBottom: 12 },
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
  cardSubNeu: { fontSize: 7, marginTop: 2, color: '#888' },
  // Section
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 5 },
  // Summary strip
  summaryRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  summaryItem: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f7f7f8', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 8 },
  summaryLabel: { fontSize: 7, color: '#888', alignSelf: 'center' },
  summaryValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },
  // Table
  tableHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 4, borderRadius: 2, marginBottom: 1 },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#555' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fbfbfc' },
  cell: { fontSize: 7.5, color: '#333' },
  cellBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111' },
  cellPos: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  cellMuted: { fontSize: 6.5, color: '#888' },
  cellWarn: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#d97706' },
  cellGray: { fontSize: 7, color: '#aaa' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 12 },
  footerText: { fontSize: 7, color: '#aaa' },
})

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTenure(months: number, days: number, text: string | null) {
  if (text) return text
  const parts: string[] = []
  if (months > 0) parts.push(`${months}m`)
  if (days > 0) parts.push(`${days}d`)
  return parts.join(' ') || '—'
}

export function FixedDepositPdf({ data }: { data: FDPdfData }) {
  const { stats, fds } = data
  const dateStr = data.generatedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const activeFDs = fds.filter((f) => !f.disabled && !f.isMatured)
  const maturedFDs = fds.filter((f) => !f.disabled && f.isMatured)
  const disabledFDs = fds.filter((f) => f.disabled)

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>Fixed Deposits</Text>
            <Text style={S.headerSub}>Generated {dateStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.headerValueLabel}>Total Corpus</Text>
            <Text style={S.headerValue}>{fmtINRPdf(stats.totalMaturity)}</Text>
          </View>
        </View>

        {/* Summary stat cards */}
        <View style={S.cardsRow}>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Principal</Text>
            <Text style={S.cardValue}>{fmtINRPdf(stats.totalPrincipal)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Corpus</Text>
            <Text style={S.cardValue}>{fmtINRPdf(stats.totalMaturity)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Interest</Text>
            <Text style={[S.cardValue, { color: '#16a34a' }]}>{fmtINRPdf(stats.totalInterest)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Avg Rate</Text>
            <Text style={S.cardValue}>{stats.avgRate.toFixed(2)}%</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Interest This Year</Text>
            <Text style={S.cardValue}>{fmtINRPdf(stats.interestThisYear)}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Active FDs</Text>
            <Text style={S.cardValue}>{stats.activeFDs}</Text>
            <Text style={S.cardSubNeu}>deposits</Text>
          </View>
        </View>

        {/* FD Table */}
        <Text style={[S.sectionTitle, { marginBottom: 6 }]}>
          All Fixed Deposits ({fds.filter((f) => !f.disabled).length} active · {disabledFDs.length} disabled)
        </Text>
        <View style={S.tableHead}>
          <Text style={[S.tableHeadCell, { flex: 2 }]}>Bank</Text>
          <Text style={[S.tableHeadCell, { flex: 1.5 }]}>FD Number</Text>
          <Text style={[S.tableHeadCell, { flex: 1.1, textAlign: 'right' }]}>Principal</Text>
          <Text style={[S.tableHeadCell, { flex: 0.7, textAlign: 'right' }]}>Rate</Text>
          <Text style={[S.tableHeadCell, { flex: 0.9 }]}>Tenure</Text>
          <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'right' }]}>Start</Text>
          <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'right' }]}>Maturity</Text>
          <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>At Maturity</Text>
          <Text style={[S.tableHeadCell, { flex: 0.8 }]}>Status</Text>
        </View>

        {[...activeFDs, ...maturedFDs, ...disabledFDs].map((fd, i) => {
          const bank = fd.bankName + (fd.branchName ? `, ${fd.branchName}` : '')
          const isAlt = i % 2 === 1
          const statusText = fd.disabled ? 'Disabled' : fd.isMatured ? 'Matured' : 'Active'
          const statusStyle = fd.disabled ? S.cellGray : fd.isMatured ? S.cellWarn : S.cellPos
          return (
            <View key={i} style={isAlt ? S.tableRowAlt : S.tableRow} wrap={false}>
              <Text style={[S.cellBold, { flex: 2 }]}>{bank}</Text>
              <Text style={[S.cellMuted, { flex: 1.5 }]}>{fd.fdNumber ?? '—'}</Text>
              <Text style={[S.cell, { flex: 1.1, textAlign: 'right' }]}>{fmtINRPdf(fd.principal)}</Text>
              <Text style={[S.cell, { flex: 0.7, textAlign: 'right' }]}>{fd.interestRate.toFixed(2)}%</Text>
              <Text style={[S.cell, { flex: 0.9 }]}>{fmtTenure(fd.tenureMonths, fd.tenureDays, fd.tenureText)}</Text>
              <Text style={[S.cell, { flex: 1, textAlign: 'right' }]}>{fmtDate(fd.startDate)}</Text>
              <Text style={[S.cell, { flex: 1, textAlign: 'right' }]}>{fmtDate(fd.maturityDate)}</Text>
              <Text style={[S.cellBold, { flex: 1.2, textAlign: 'right' }]}>
                {fd.maturityAmount != null ? fmtINRPdf(fd.maturityAmount) : '—'}
              </Text>
              <Text style={[statusStyle, { flex: 0.8 }]}>{statusText}</Text>
            </View>
          )
        })}

        {/* Totals row */}
        <View style={[S.tableRow, { backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 1 }]} wrap={false}>
          <Text style={[S.cellBold, { flex: 2 }]}>Total</Text>
          <Text style={[S.cell, { flex: 1.5 }]} />
          <Text style={[S.cellBold, { flex: 1.1, textAlign: 'right' }]}>{fmtINRPdf(stats.totalPrincipal)}</Text>
          <Text style={[S.cell, { flex: 0.7 }]} />
          <Text style={[S.cell, { flex: 0.9 }]} />
          <Text style={[S.cell, { flex: 1 }]} />
          <Text style={[S.cell, { flex: 1 }]} />
          <Text style={[S.cellBold, { flex: 1.2, textAlign: 'right' }]}>{fmtINRPdf(stats.totalMaturity)}</Text>
          <Text style={[S.cell, { flex: 0.8 }]} />
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Personal Investment Tracker · Fixed Deposits</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
