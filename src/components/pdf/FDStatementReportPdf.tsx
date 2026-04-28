import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { FDReportData, FDEntry } from '@/lib/fd-statement-report/types'

export interface FDStatementReportPdfData {
  reportData: FDReportData
  bankName: string
  accountHolderName?: string
  accountNumber?: string
  statementFromDate?: string
  statementToDate?: string
  generatedAt: Date
}

const TXN_LABELS: Record<string, string> = {
  interest_payout: 'Interest',
  maturity_principal: 'Maturity Principal',
  maturity_interest: 'Maturity Interest',
  premature_principal: 'Premature Closure',
  premature_interest: 'Premature Interest',
  other: 'Other',
}

const S = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#5ee0a4', paddingBottom: 8, marginBottom: 12 },
  headerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 8, color: '#666', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { fontSize: 7, color: '#999' },
  headerValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 7, color: '#888' },
  cardValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  fdSection: { marginBottom: 14 },
  fdHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f0f0f0', paddingVertical: 5, paddingHorizontal: 6, borderRadius: 2, marginBottom: 1 },
  fdHeaderLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fdNumber: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },
  fdBadge: { fontSize: 7, color: '#666' },
  fdTotalLabel: { fontSize: 7, color: '#888' },
  fdTotalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  tableHead: { flexDirection: 'row', gap: 4, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#555' },
  tableRow: { flexDirection: 'row', gap: 4, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', gap: 4, paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fbfbfc' },
  cell: { fontSize: 8, color: '#333' },
  cellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111' },
  cellGreen: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  cellOrange: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#d97706' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: '#f7fdf7', borderTopWidth: 0.5, borderTopColor: '#d0ecd0', marginBottom: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 12 },
  footerText: { fontSize: 7, color: '#aaa' },
  colDate: { width: 68 },
  colDesc: { flex: 1 },
  colType: { width: 80 },
  colAmt: { width: 72, textAlign: 'right' },
})

function FDSection({ fd, index }: { fd: FDEntry; index: number }) {
  const closureLabel = fd.closureType === 'matured' ? 'Matured' : fd.closureType === 'premature' ? 'Premature' : 'Ongoing'
  const closureColor = fd.closureType === 'matured' ? '#16a34a' : fd.closureType === 'premature' ? '#d97706' : '#6366f1'

  return (
    <View style={S.fdSection} wrap={false}>
      <View style={S.fdHeader}>
        <View style={S.fdHeaderLeft}>
          <Text style={S.fdNumber}>{fd.fdNumber}</Text>
          <Text style={[S.fdBadge, { color: closureColor }]}>{closureLabel}</Text>
          {fd.closureDate && <Text style={S.fdBadge}>· {fd.closureDate}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={S.fdTotalLabel}>Total Interest</Text>
          <Text style={S.fdTotalValue}>{fmtINRPdf(fd.totalInterest)}</Text>
        </View>
      </View>

      <View style={S.tableHead}>
        <Text style={[S.tableHeadCell, S.colDate]}>Date</Text>
        <Text style={[S.tableHeadCell, S.colDesc]}>Description</Text>
        <Text style={[S.tableHeadCell, S.colType]}>Type</Text>
        <Text style={[S.tableHeadCell, S.colAmt]}>Amount</Text>
      </View>

      {fd.transactions.map((t, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={[S.cell, S.colDate]}>{t.date}</Text>
          <Text style={[S.cell, S.colDesc]}>{t.description}</Text>
          <Text style={[S.cell, S.colType]}>{TXN_LABELS[t.type] ?? t.type}</Text>
          <Text style={[S.cellGreen, S.colAmt]}>{fmtINRPdf(t.amount)}</Text>
        </View>
      ))}

      <View style={S.summaryRow}>
        <Text style={[S.cell, { color: '#555' }]}>Interest total: </Text>
        <Text style={S.cellGreen}>{fmtINRPdf(fd.totalInterest)}</Text>
        {fd.principalReturned != null && (
          <>
            <Text style={[S.cell, { color: '#555', marginLeft: 12 }]}>Principal: </Text>
            <Text style={S.cellBold}>{fmtINRPdf(fd.principalReturned)}</Text>
          </>
        )}
      </View>
    </View>
  )
}

export function FDStatementReportPdf({ data }: { data: FDStatementReportPdfData }) {
  const { reportData, bankName, accountHolderName, accountNumber, statementFromDate, statementToDate, generatedAt } = data
  const totalInterest = reportData.fds.reduce((s, f) => s + f.totalInterest, 0)
  const maturedCount = reportData.fds.filter((f) => f.closureType === 'matured').length
  const prematureCount = reportData.fds.filter((f) => f.closureType === 'premature').length
  const ongoingCount = reportData.fds.filter((f) => f.closureType === 'ongoing').length

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.headerTitle}>{bankName}</Text>
            {accountHolderName && <Text style={S.headerSub}>{accountHolderName}{accountNumber ? ` · A/C ${accountNumber}` : ''}</Text>}
            {statementFromDate && statementToDate && (
              <Text style={S.headerSub}>Statement period: {statementFromDate} to {statementToDate}</Text>
            )}
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerLabel}>Total Interest Earned</Text>
            <Text style={S.headerValue}>{fmtINRPdf(totalInterest)}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={S.statsRow}>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total FDs</Text>
            <Text style={S.cardValue}>{reportData.fds.length}</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLabel}>Total Interest</Text>
            <Text style={[S.cardValue, { color: '#16a34a' }]}>{fmtINRPdf(totalInterest)}</Text>
          </View>
          {maturedCount > 0 && (
            <View style={S.card}>
              <Text style={S.cardLabel}>Matured</Text>
              <Text style={S.cardValue}>{maturedCount}</Text>
            </View>
          )}
          {prematureCount > 0 && (
            <View style={S.card}>
              <Text style={S.cardLabel}>Premature Closure</Text>
              <Text style={[S.cardValue, { color: '#d97706' }]}>{prematureCount}</Text>
            </View>
          )}
          {ongoingCount > 0 && (
            <View style={S.card}>
              <Text style={S.cardLabel}>Ongoing</Text>
              <Text style={[S.cardValue, { color: '#6366f1' }]}>{ongoingCount}</Text>
            </View>
          )}
        </View>

        {/* FD sections */}
        {reportData.fds.map((fd, i) => (
          <FDSection key={fd.fdNumber} fd={fd} index={i} />
        ))}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>FD Statement Report · {bankName}</Text>
          <Text style={S.footerText}>Generated {generatedAt.toLocaleDateString('en-IN')}</Text>
        </View>
      </Page>
    </Document>
  )
}
