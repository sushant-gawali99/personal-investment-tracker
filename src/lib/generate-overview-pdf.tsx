import type { PdfData } from './pdf-data'

export async function generateOverviewPdf(data: PdfData): Promise<void> {
  const [{ pdf }, { OverviewPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/OverviewPdf'),
  ])
  const blob = await pdf(<OverviewPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
