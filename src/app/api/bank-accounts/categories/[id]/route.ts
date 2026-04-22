import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.transactionCategory.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.transactionCategory.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      kind: body.kind ?? undefined,
      icon: body.icon ?? undefined,
      color: body.color ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.transactionCategory.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
  await prisma.transactionCategory.update({ where: { id }, data: { disabled: true } });
  return NextResponse.json({ ok: true });
}
