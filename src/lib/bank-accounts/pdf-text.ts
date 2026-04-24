export interface PdfTextResult {
  text: string;
  pageCount: number;
}

function ensurePdfJsPolyfills() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(_init?: unknown) {}
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      inverse() { return this; }
      transformPoint(p: unknown) { return p; }
    }
    g.DOMMatrix = DOMMatrixStub;
  }
  if (typeof g.ImageData === "undefined") {
    class ImageDataStub {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace = "srgb" as const;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    }
    g.ImageData = ImageDataStub;
  }
  if (typeof g.Path2D === "undefined") {
    class Path2DStub {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
    g.Path2D = Path2DStub;
  }
}

export async function extractPdfText(pdfBytes: Buffer, password?: string): Promise<PdfTextResult> {
  ensurePdfJsPolyfills();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(pdfBytes), password: password || undefined });
  try {
    const result = await parser.getText();
    return { text: result.text ?? "", pageCount: result.total ?? 0 };
  } finally {
    await parser.destroy();
  }
}

export const TEXT_VISION_FALLBACK_THRESHOLD = 200;
