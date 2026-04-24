export interface PdfTextResult {
  text: string;
  pageCount: number;
}

interface PdfTextRun { T: string }
interface PdfTextItem { x: number; y: number; w?: number; R: PdfTextRun[] }
interface PdfPage { Texts: PdfTextItem[] }
interface PdfOutput { Pages: PdfPage[] }

function decodeRun(r: PdfTextRun): string {
  try {
    return decodeURIComponent(r.T);
  } catch {
    return r.T;
  }
}

function reconstructText(output: PdfOutput): string {
  const pages: string[] = [];
  for (const page of output.Pages ?? []) {
    const rows = new Map<number, PdfTextItem[]>();
    for (const t of page.Texts ?? []) {
      const key = Math.round(t.y * 10); // group by ~0.1 unit bands
      const list = rows.get(key) ?? [];
      list.push(t);
      rows.set(key, list);
    }
    const sortedYs = [...rows.keys()].sort((a, b) => a - b);
    const lines: string[] = [];
    for (const y of sortedYs) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x);
      let line = "";
      let lastX = -Infinity;
      for (const it of items) {
        const piece = it.R.map(decodeRun).join("");
        if (!piece) continue;
        if (lastX !== -Infinity && it.x - lastX > 0.5) line += "  ";
        else if (line && !line.endsWith(" ")) line += " ";
        line += piece;
        lastX = it.x + (it.w ?? 0);
      }
      if (line.trim()) lines.push(line);
    }
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
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
        const output = data as unknown as PdfOutput;
        const text = reconstructText(output);
        const pageCount = output.Pages?.length ?? 0;
        resolve({ text, pageCount });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    parser.parseBuffer(pdfBytes);
  });
}

export const TEXT_VISION_FALLBACK_THRESHOLD = 200;
