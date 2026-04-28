import type { FDStatementReportPdfData } from '@/components/pdf/FDStatementReportPdf'

export async function generateFDStatementReportPdf(data: FDStatementReportPdfData): Promise<void> {
  const [{ pdf }, { FDStatementReportPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/FDStatementReportPdf'),
  ])
  const blob = await pdf(<FDStatementReportPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fd-statement-report-${data.bankName.replace(/\s+/g, '-').toLowerCase()}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
