import type { ZerodhaPdfData } from '@/components/pdf/ZerodhaPdf'

export async function generateZerodhaPdf(data: ZerodhaPdfData): Promise<void> {
  const [{ pdf }, { ZerodhaPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/ZerodhaPdf'),
  ])
  const blob = await pdf(<ZerodhaPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
