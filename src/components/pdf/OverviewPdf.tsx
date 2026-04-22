import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { AllocationDonut } from './charts/AllocationDonut'
import { FdByBankBars } from './charts/FdByBankBars'
import { TopHoldingsBars } from './charts/TopHoldingsBars'
import { fmtINRPdf } from '@/lib/pdf-data'
import type { PdfData } from '@/lib/pdf-data'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', backgroundColor: '#ffffff', fontSize: 10, color: '#111' },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: '#ff385c', paddingBottom: 10, marginBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 9, color: '#666', marginTop: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerValueLabel: { fontSize: 9, color: '#999' },
  headerValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  // Stat cards
  cardsRow: { flexDirection: 'row', marginBottom: 16 },
  card: { flex: 1, backgroundColor: '#f7f7f8', borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 8, color: '#888' },
  cardValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111', marginTop: 2 },
  cardSub: { fontSize: 9, marginTop: 2 },
  cardSubPos: { fontSize: 9, marginTop: 2, color: '#16a34a' },
  cardSubNeg: { fontSize: 9, marginTop: 2, color: '#dc2626' },
  cardSubNeu: { fontSize: 9, marginTop: 2, color: '#888' },
  // Sections
  twoCol: { flexDirection: 'row', marginBottom: 14 },
  section: { backgroundColor: '#f7f7f8', borderRadius: 4, padding: 10 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#555', marginBottom: 8 },
  // MF table
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  rowLabel: { fontSize: 9, color: '#666' },
  rowValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111' },
  rowValuePos: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  rowValueNeg: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  // Maturities
  maturityItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#e0e0e0', paddingTop: 8, marginTop: 14 },
  footerText: { fontSize: 8, color: '#aaa' },
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

        {/* Allocation + MF/Maturities */}
        <View style={styles.twoCol}>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>Asset Allocation</Text>
            <AllocationDonut data={data} />
          </View>
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionLabel}>Mutual Funds</Text>
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
            {data.upcomingMaturities.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>Upcoming Maturities</Text>
                {data.upcomingMaturities.map((m, i) => (
                  <View key={i} style={styles.maturityItem}>
                    <Text style={{ fontSize: 8, color: '#444' }}>{m.bankName}</Text>
                    <Text style={{ fontSize: 8, color: '#444' }}>{fmtINRPdf(m.amount)} · {m.daysRemaining}d</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* FD by Bank */}
        {data.fdsByBank.length > 0 && (
          <View style={[styles.section, { marginBottom: 14 }]}>
            <Text style={styles.sectionLabel}>FD Corpus by Bank</Text>
            <FdByBankBars data={data} />
          </View>
        )}

        {/* Top Holdings */}
        {data.holdings.length > 0 && (
          <View style={[styles.section, { marginBottom: 14 }]}>
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
