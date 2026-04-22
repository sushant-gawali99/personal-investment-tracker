import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const stmt = await prisma.fDStatement.findFirst({ where: { id, userId }, select: { sourcePdfUrl: true } });
  if (!stmt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(new URL(stmt.sourcePdfUrl, req.url));
}
