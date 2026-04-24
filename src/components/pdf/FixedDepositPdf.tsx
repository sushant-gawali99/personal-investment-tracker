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
  cardsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 7, color: '#888' },
  cardValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  cardSubNeu: { fontSize: 7, marginTop: 2, color: '#888' },
  // Section
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 5 },
  // Table
  tableHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', paddingVertical: 5, paddingHorizontal: 6, borderRadius: 2, marginBottom: 1 },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#555' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fbfbfc' },
  cell: { fontSize: 8, color: '#333' },
  cellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111' },
  cellPos: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  cellMuted: { fontSize: 7, color: '#888' },
  cellWarn: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#d97706' },
  cellGray: { fontSize: 7.5, color: '#aaa' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 12 },
  footerText: { fontSize: 7, color: '#aaa' },
})

// Column flex ratios — must match between header and rows
const COL = {
  bank:      2.6,
  fdNum:     1.8,
  principal: 1.4,
  rateTenure:1.4,
  start:     1.2,
  maturity:  1.2,
  atMaturity:1.4,
  status:    1.0,
}

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
      <Page size="A4" orientation="landscape" style={S.page}>
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
          <Text style={[S.tableHeadCell, { flex: COL.bank }]}>Bank</Text>
          <Text style={[S.tableHeadCell, { flex: COL.fdNum }]}>FD Number</Text>
          <Text style={[S.tableHeadCell, { flex: COL.principal, textAlign: 'right' }]}>Principal</Text>
          <Text style={[S.tableHeadCell, { flex: COL.rateTenure, textAlign: 'center' }]}>Rate / Tenure</Text>
          <Text style={[S.tableHeadCell, { flex: COL.start, textAlign: 'right' }]}>Start</Text>
          <Text style={[S.tableHeadCell, { flex: COL.maturity, textAlign: 'right' }]}>Maturity</Text>
          <Text style={[S.tableHeadCell, { flex: COL.atMaturity, textAlign: 'right' }]}>At Maturity</Text>
          <Text style={[S.tableHeadCell, { flex: COL.status }]}>Status</Text>
        </View>

        {[...activeFDs, ...maturedFDs, ...disabledFDs].map((fd, i) => {
          const bank = fd.bankName + (fd.branchName ? `, ${fd.branchName}` : '')
          const isAlt = i % 2 === 1
          const statusText = fd.disabled ? 'Disabled' : fd.isMatured ? 'Matured' : 'Active'
          const statusStyle = fd.disabled ? S.cellGray : fd.isMatured ? S.cellWarn : S.cellPos
          return (
            <View key={i} style={isAlt ? S.tableRowAlt : S.tableRow} wrap={false}>
              <Text style={[S.cellBold, { flex: COL.bank }]}>{bank}</Text>
              <Text style={[S.cellMuted, { flex: COL.fdNum }]}>{fd.fdNumber ?? '—'}</Text>
              <Text style={[S.cell, { flex: COL.principal, textAlign: 'right' }]}>{fmtINRPdf(fd.principal)}</Text>
              <Text style={[S.cell, { flex: COL.rateTenure, textAlign: 'center' }]}>
                {fd.interestRate.toFixed(2)}% · {fmtTenure(fd.tenureMonths, fd.tenureDays, fd.tenureText)}
              </Text>
              <Text style={[S.cell, { flex: COL.start, textAlign: 'right' }]}>{fmtDate(fd.startDate)}</Text>
              <Text style={[S.cell, { flex: COL.maturity, textAlign: 'right' }]}>{fmtDate(fd.maturityDate)}</Text>
              <Text style={[S.cellBold, { flex: COL.atMaturity, textAlign: 'right' }]}>
                {fd.maturityAmount != null ? fmtINRPdf(fd.maturityAmount) : '—'}
              </Text>
              <Text style={[statusStyle, { flex: COL.status }]}>{statusText}</Text>
            </View>
          )
        })}

        {/* Totals row */}
        <View style={[S.tableRow, { backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 1 }]} wrap={false}>
          <Text style={[S.cellBold, { flex: COL.bank }]}>Total</Text>
          <Text style={[S.cell, { flex: COL.fdNum }]} />
          <Text style={[S.cellBold, { flex: COL.principal, textAlign: 'right' }]}>{fmtINRPdf(stats.totalPrincipal)}</Text>
          <Text style={[S.cell, { flex: COL.rateTenure }]} />
          <Text style={[S.cell, { flex: COL.start }]} />
          <Text style={[S.cell, { flex: COL.maturity }]} />
          <Text style={[S.cellBold, { flex: COL.atMaturity, textAlign: 'right' }]}>{fmtINRPdf(stats.totalMaturity)}</Text>
          <Text style={[S.cell, { flex: COL.status }]} />
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
