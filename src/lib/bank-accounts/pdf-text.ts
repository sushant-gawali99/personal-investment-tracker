export interface PdfTextResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(pdfBytes: Buffer, password?: string): Promise<PdfTextResult> {
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true, password);
    parser.on("pdfParser_dataError", (err) => {
      const msg = err instanceof Error ? err.message : (err as { parserError?: Error })?.parserError?.message ?? "PDF parse failed";
      reject(new Error(msg));
    });
    parser.on("pdfParser_dataReady", (data) => {
      try {
        const text = parser.getRawTextContent();
        const pageCount = Array.isArray((data as { Pages?: unknown[] }).Pages)
          ? (data as { Pages: unknown[] }).Pages.length
          : 0;
        resolve({ text, pageCount });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    parser.parseBuffer(pdfBytes);
  });
}

export const TEXT_VISION_FALLBACK_THRESHOLD = 200;
