import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { linkTransactionsForFd } from "@/lib/fd-link/link-batch";
import { findOrCreateFdBank, findOrCreateFdBranch } from "@/lib/fd-bank";

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

  // If bankName is being changed, resolve to FdBank and update bankId so
  // the relation stays in sync. Always store the bank's canonical name in
  // the denormalised bankName field. Branch is resolved against the
  // resolved (or existing) bank — if the user only changes the branch,
  // we keep the existing bank.
  let bankPatch: { bankName: string; bankId: string } | undefined;
  let bankIdForBranch: string | null = existing.bankId ?? null;
  if (typeof body.bankName === "string" && body.bankName.trim()) {
    const bank = await findOrCreateFdBank(prisma, userId, body.bankName);
    bankPatch = { bankName: bank.name, bankId: bank.id };
    bankIdForBranch = bank.id;
  }

  // Resolve branch only when branchName is present in the patch (allow
  // null/empty string to clear it). Requires we know the bank — if the FD
  // has no bankId yet (unbackfilled) we just store the raw name.
  let branchPatch: { branchName: string | null; branchId: string | null } | undefined;
  if (Object.prototype.hasOwnProperty.call(body, "branchName")) {
    const raw = typeof body.branchName === "string" ? body.branchName.trim() : "";
    if (!raw) {
      branchPatch = { branchName: null, branchId: null };
    } else if (bankIdForBranch) {
      const branch = await findOrCreateFdBranch(prisma, userId, bankIdForBranch, raw);
      branchPatch = branch ? { branchName: branch.name, branchId: branch.id } : { branchName: raw, branchId: null };
    } else {
      branchPatch = { branchName: raw, branchId: null };
    }
  }

  const fd = await prisma.fixedDeposit.update({
    where: { id },
    data: {
      ...body,
      ...bankPatch,
      ...branchPatch,
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
