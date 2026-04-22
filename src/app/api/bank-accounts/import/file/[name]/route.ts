import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

function resolveDir(): string {
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements")
    : path.join(process.cwd(), "public", "uploads", "bank-statements");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!/^[a-f0-9]+\.pdf$/.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(resolveDir(), name));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
