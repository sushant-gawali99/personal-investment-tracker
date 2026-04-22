import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({
    where: { id, userId },
    include: { account: true },
  });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...imp,
    stagedTransactions: imp.stagedTransactions ? JSON.parse(imp.stagedTransactions) : [],
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.statementImport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
