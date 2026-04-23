import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.deleteMany({ where: { importId: id, userId } });

  await prisma.statementImport.update({
    where: { id },
    data: {
      status: "extracting",
      newCount: 0,
      extractedCount: 0,
      duplicateCount: 0,
      stagedTransactions: null,
      errorMessage: null,
    },
  });

  void runExtraction(id, userId, undefined);

  return NextResponse.json({ importId: id, status: "extracting" }, { status: 202 });
}
