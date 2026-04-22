export interface PdfTextResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(pdfBytes: Buffer): Promise<PdfTextResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
  try {
    const result = await parser.getText();
    return { text: result.text ?? "", pageCount: result.total ?? 0 };
  } finally {
    await parser.destroy();
  }
}

export const TEXT_VISION_FALLBACK_THRESHOLD = 200;
