import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "nj-india")
    : path.join(process.cwd(), "public", "uploads", "nj-india");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const stmt = await prisma.nJIndiaStatement.findUnique({ where: { id } });
  if (!stmt || stmt.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.nJIndiaStatement.delete({ where: { id } });

  // Best-effort file cleanup.
  const m = stmt.fileUrl.match(/\/api\/nj-india\/file\/([a-f0-9]+\.pdf)$/);
  if (m) {
    try { await unlink(path.join(uploadDir(), m[1])); } catch {}
  }

  return NextResponse.json({ ok: true });
}
