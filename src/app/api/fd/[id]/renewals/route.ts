import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;
  const fd = await prisma.fixedDeposit.findFirst({ where: { id, userId } });
  if (!fd) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { startDate, maturityDate, principal, interestRate, tenureMonths, maturityAmount, maturityInstruction, payoutFrequency } = body;

  if (!startDate || !maturityDate || !principal || !interestRate || !tenureMonths) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const count = await prisma.fDRenewal.count({ where: { fdId: id } });

  const renewal = await prisma.fDRenewal.create({
    data: {
      fdId: id,
      renewalNumber: count + 1,
      startDate: new Date(startDate),
      maturityDate: new Date(maturityDate),
      principal: Number(principal),
      interestRate: Number(interestRate),
      tenureMonths: Number(tenureMonths),
      maturityAmount: maturityAmount ? Number(maturityAmount) : null,
      maturityInstruction: maturityInstruction || null,
      payoutFrequency: payoutFrequency || null,
    },
  });

  return NextResponse.json({ renewal }, { status: 201 });
}
