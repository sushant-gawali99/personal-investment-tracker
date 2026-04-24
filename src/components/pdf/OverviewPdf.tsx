import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { AllocationDonut } from './charts/AllocationDonut'
import { FdByBankBars } from './charts/FdByBankBars'
import { TopHoldingsBars } from './charts/TopHoldingsBars'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#ff385c', paddingBottom: 8, marginBottom: 12 },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 8, color: '#666', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerValueLabel: { fontSize: 8, color: '#999' },
  headerValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  // Stat cards
  cardsRow: { flexDirection: 'row', marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 7 },
  cardLabel: { fontSize: 7, color: '#888' },
  cardValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  cardSub: { fontSize: 8, marginTop: 2 },
  cardSubPos: { fontSize: 8, marginTop: 2, color: '#16a34a' },
  cardSubNeg: { fontSize: 8, marginTop: 2, color: '#dc2626' },
  cardSubNeu: { fontSize: 8, marginTop: 2, color: '#888' },
  // Sections
  twoCol: { flexDirection: 'row', marginBottom: 10 },
  section: { backgroundColor: '#f7f7f8', borderRadius: 4, padding: 8 },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#555', marginBottom: 6 },
  // Table rows
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  rowLabel: { fontSize: 8, color: '#666' },
  rowValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111' },
  rowValuePos: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  rowValueNeg: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 6, marginTop: 10 },
  footerText: { fontSize: 7, color: '#aaa' },
})

interface Props {
  data: PdfData
}

function StatCard({ label, value, sub, subType }: {
  label: string
  value: string
  sub: string
  subType: 'positive' | 'negative' | 'neutral'
}) {
  const subStyle = subType === 'positive' ? styles.cardSubPos
    : subType === 'negative' ? styles.cardSubNeg
    : styles.cardSubNeu
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={subStyle}>{sub}</Text>
    </View>
  )
}

export function OverviewPdf({ data }: Props) {
  const dateStr = data.generatedAt.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Portfolio Summary</Text>
            <Text style={styles.headerSub}>Generated {dateStr} · {data.userEmail}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerValueLabel}>Total Value</Text>
            <Text style={styles.headerValue}>{fmtINRPdf(data.totalValue)}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={styles.cardsRow}>
          <StatCard
            label="Equity"
            value={data.equity.currentValue > 0 ? fmtINRPdf(data.equity.currentValue) : '—'}
            sub={data.equity.currentValue > 0 ? `${data.equity.pnlPct >= 0 ? '+' : ''}${data.equity.pnlPct.toFixed(2)}%` : 'Not connected'}
            subType={data.equity.pnlPct >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="FD Corpus"
            value={data.fd.totalMaturity > 0 ? fmtINRPdf(data.fd.totalMaturity) : '—'}
            sub={data.fd.totalMaturity > 0 ? `${data.fd.weightedRate.toFixed(2)}% avg rate` : 'No FDs'}
            subType="neutral"
          />
          <StatCard
            label="Gold"
            value={data.gold.currentValue > 0 ? fmtINRPdf(data.gold.currentValue) : '—'}
            sub={data.gold.gainLossPct != null ? `${data.gold.gainLossPct >= 0 ? '+' : ''}${data.gold.gainLossPct.toFixed(1)}%` : '—'}
            subType={data.gold.gainLossPct != null ? (data.gold.gainLossPct >= 0 ? 'positive' : 'negative') : 'neutral'}
          />
          <StatCard
            label="Portfolio CAGR"
            value={data.cagr !== 0 ? `${data.cagr.toFixed(2)}%` : '—'}
            sub="annualised"
            subType={data.cagr > 0 ? 'positive' : 'neutral'}
          />
        </View>

        {/* Allocation + Equity & MF */}
        <View style={styles.twoCol}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>Asset Allocation</Text>
            <AllocationDonut data={data} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {data.equity.currentValue > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Equity</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Invested</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.equity.totalInvested)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Current Value</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.equity.currentValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>P&L</Text>
                  <Text style={data.equity.totalPnL >= 0 ? styles.rowValuePos : styles.rowValueNeg}>
                    {data.equity.totalPnL >= 0 ? '+' : ''}{fmtINRPdf(data.equity.totalPnL)}
                  </Text>
                </View>
              </View>
            )}
            {data.mf.currentValue > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Mutual Funds — Zerodha</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Invested</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.mf.totalInvested)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Current Value</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.mf.currentValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>P&L</Text>
                  <Text style={data.mf.totalPnL >= 0 ? styles.rowValuePos : styles.rowValueNeg}>
                    {data.mf.totalPnL >= 0 ? '+' : ''}{fmtINRPdf(data.mf.totalPnL)}
                  </Text>
                </View>
              </View>
            )}
            {data.nj && data.nj.currentValue > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Mutual Funds — NJ India</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Invested</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.nj.totalInvested)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Current Value</Text>
                  <Text style={styles.rowValue}>{fmtINRPdf(data.nj.currentValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>P&L</Text>
                  <Text style={data.nj.totalPnL >= 0 ? styles.rowValuePos : styles.rowValueNeg}>
                    {data.nj.totalPnL >= 0 ? '+' : ''}{fmtINRPdf(data.nj.totalPnL)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>XIRR · Schemes</Text>
                  <Text style={styles.rowValue}>
                    {data.nj.xirrPct != null ? `${data.nj.xirrPct.toFixed(2)}%` : '—'} · {data.nj.schemeCount}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Bank Balances */}
        {data.bankBalances.length > 0 && (
          <View style={[styles.section, { marginBottom: 10 }]}>
            <Text style={styles.sectionLabel}>Bank Balances</Text>
            <View style={{ flexDirection: 'row', paddingBottom: 3, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#d0d0d0' }}>
              <Text style={{ flex: 2, fontSize: 7, color: '#999' }}>Account</Text>
              <Text style={{ flex: 1, fontSize: 7, color: '#999', textAlign: 'right' }}>Balance</Text>
              <Text style={{ flex: 1, fontSize: 7, color: '#999', textAlign: 'right' }}>As of</Text>
            </View>
            {data.bankBalances.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' }}>
                <Text style={{ flex: 2, fontSize: 8, color: '#333' }}>{b.label}</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: b.closingBalance != null && b.closingBalance < 0 ? '#dc2626' : '#111', textAlign: 'right' }}>
                  {b.closingBalance != null ? fmtINRPdf(b.closingBalance) : '—'}
                </Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#888', textAlign: 'right' }}>
                  {b.asOf ? new Date(b.asOf).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* FD by Bank */}
        {data.fdsByBank.length > 0 && (
          <View style={[styles.section, { marginBottom: 10 }]}>
            <Text style={styles.sectionLabel}>FD Corpus by Bank</Text>
            <FdByBankBars data={data} />
          </View>
        )}

        {/* Top Holdings */}
        {data.holdings.length > 0 && (
          <View style={[styles.section, { marginBottom: 10 }]}>
            <Text style={styles.sectionLabel}>Top Holdings</Text>
            <TopHoldingsBars data={data} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Personal Investment Tracker</Text>
          <Text style={styles.footerText}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  )
}
