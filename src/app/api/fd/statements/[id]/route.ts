import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const statement = await prisma.fDStatement.findFirst({
    where: { id, userId },
    include: {
      transactions: {
        orderBy: { txnDate: "desc" },
        include: { fd: { select: { id: true, fdNumber: true, accountNumber: true, principal: true } } },
      },
    },
  });
  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(statement);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const stmt = await prisma.fDStatement.findFirst({ where: { id, userId } });
  if (!stmt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.fDStatement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
