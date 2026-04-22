import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.bankAccount.update({
    where: { id },
    data: {
      label: body.label ?? undefined,
      bankName: body.bankName ?? undefined,
      accountNumberLast4: body.accountNumberLast4 ?? undefined,
      accountType: body.accountType ?? undefined,
      disabled: body.disabled ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.bankAccount.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const txnCount = await prisma.transaction.count({ where: { accountId: id } });
  if (txnCount > 0) {
    return NextResponse.json(
      { error: "Account has transactions. Disable it instead of deleting." },
      { status: 409 },
    );
  }
  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
