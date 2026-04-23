import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let pdfPassword: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { password?: string } | null;
    const pw = body?.password?.trim();
    if (pw) pdfPassword = pw;
  } catch {
    /* no body — extraction proceeds without a password */
  }

  if (imp.status === "extracting") {
    return NextResponse.json({ importId: id, status: "extracting", alreadyRunning: true }, { status: 202 });
  }

  await prisma.statementImport.update({
    where: { id },
    data: { status: "extracting", errorMessage: null },
  });

  void runExtraction(id, userId, pdfPassword);

  return NextResponse.json({ importId: id, status: "extracting" }, { status: 202 });
}
