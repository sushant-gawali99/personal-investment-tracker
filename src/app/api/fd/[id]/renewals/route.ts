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
  const { startDate, maturityDate, principal, interestRate, tenureMonths, tenureDays, tenureText, maturityAmount, maturityInstruction, payoutFrequency } = body;

  const tenureMonthsNum = Number(tenureMonths) || 0;
  const tenureDaysNum = Number(tenureDays) || 0;
  if (!startDate || !maturityDate || !principal || !interestRate || (tenureMonthsNum <= 0 && tenureDaysNum <= 0)) {
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
      tenureMonths: tenureMonthsNum,
      tenureDays: tenureDaysNum,
      tenureText: typeof tenureText === "string" && tenureText.trim() ? tenureText.trim().slice(0, 100) : null,
      maturityAmount: maturityAmount ? Number(maturityAmount) : null,
      maturityInstruction: maturityInstruction || null,
      payoutFrequency: payoutFrequency || null,
    },
  });

  return NextResponse.json({ renewal }, { status: 201 });
}
