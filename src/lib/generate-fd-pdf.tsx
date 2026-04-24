import type { FDPdfData } from '@/components/pdf/FixedDepositPdf'

export async function generateFDPdf(data: FDPdfData): Promise<void> {
  const [{ pdf }, { FixedDepositPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/FixedDepositPdf'),
  ])
  const blob = await pdf(<FixedDepositPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
