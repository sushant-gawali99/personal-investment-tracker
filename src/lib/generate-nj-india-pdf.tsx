import type { NJIndiaPdfData } from '@/components/pdf/NJIndiaPdf'

export async function generateNJIndiaPdf(data: NJIndiaPdfData): Promise<void> {
  const [{ pdf }, { NJIndiaPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/NJIndiaPdf'),
  ])
  const blob = await pdf(<NJIndiaPdf data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
