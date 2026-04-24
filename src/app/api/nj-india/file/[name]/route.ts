import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function resolveDir(): string {
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "nj-india")
    : path.join(process.cwd(), "public", "uploads", "nj-india");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { name } = await params;
  if (!/^[a-f0-9]+\.pdf$/.test(name)) return new NextResponse("Not found", { status: 404 });

  const fileUrl = `/api/nj-india/file/${name}`;
  const stmt = await prisma.nJIndiaStatement.findFirst({ where: { userId, fileUrl } });
  if (!stmt) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(path.join(resolveDir(), name));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
