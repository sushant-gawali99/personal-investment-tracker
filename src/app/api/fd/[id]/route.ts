import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { linkTransactionsForFd } from "@/lib/fd-link/link-batch";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { id } = await params;

  const existing = await prisma.fixedDeposit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId && existing.userId !== "" && existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const fd = await prisma.fixedDeposit.update({
    where: { id },
    data: {
      ...body,
      principal: body.principal ? Number(body.principal) : undefined,
      interestRate: body.interestRate ? Number(body.interestRate) : undefined,
      tenureMonths: body.tenureMonths !== undefined ? Number(body.tenureMonths) : undefined,
      tenureDays: body.tenureDays !== undefined ? Number(body.tenureDays) : undefined,
      tenureText: body.tenureText !== undefined ? (typeof body.tenureText === "string" && body.tenureText.trim() ? body.tenureText.trim().slice(0, 100) : null) : undefined,
      maturityAmount: body.maturityAmount ? Number(body.maturityAmount) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      maturityDate: body.maturityDate ? new Date(body.maturityDate) : undefined,
    },
  });

  // Re-link only when identifying fields changed — otherwise (e.g. just
  // toggling `disabled` or editing notes) the existing links stay correct.
  const identityChanged =
    (body.fdNumber !== undefined && body.fdNumber !== existing.fdNumber) ||
    (body.accountNumber !== undefined && body.accountNumber !== existing.accountNumber);
  if (identityChanged) {
    try {
      await linkTransactionsForFd(userId, fd.id);
    } catch (err) {
      console.error("fd-link: linkTransactionsForFd failed", err);
    }
  }

  return NextResponse.json({ fd });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { id } = await params;

  const existing = await prisma.fixedDeposit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId && existing.userId !== "" && existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!existing.disabled) {
    return NextResponse.json({ error: "Only disabled FDs can be deleted" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.fDRenewal.deleteMany({ where: { fdId: id } }),
    prisma.fixedDeposit.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
