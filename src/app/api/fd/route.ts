import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const fds = await prisma.fixedDeposit.findMany({
    where: { userId },
    orderBy: { maturityDate: "asc" },
  });
  return NextResponse.json({ fds });
}

export async function POST(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const body = await req.json();
  const {
    bankName, fdNumber, accountNumber, principal, interestRate,
    tenureMonths, startDate, maturityDate, maturityAmount,
    interestType, compoundFreq,
    maturityInstruction, payoutFrequency, nomineeName, nomineeRelation,
    notes, sourceImageUrl, sourceImageBackUrl, renewedFromId,
  } = body;

  if (!bankName || !principal || !interestRate || !tenureMonths || !startDate || !maturityDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const duplicate = await prisma.fixedDeposit.findFirst({
    where: {
      userId,
      OR: [
        { bankName, principal: Number(principal), startDate: new Date(startDate) },
        ...(fdNumber ? [{ fdNumber }] : []),
      ],
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A Fixed Deposit with the same details already exists." },
      { status: 409 }
    );
  }

  const fd = await prisma.fixedDeposit.create({
    data: {
      userId,
      bankName,
      fdNumber: fdNumber || null,
      accountNumber: accountNumber || null,
      principal: Number(principal),
      interestRate: Number(interestRate),
      tenureMonths: Number(tenureMonths),
      startDate: new Date(startDate),
      maturityDate: new Date(maturityDate),
      maturityAmount: maturityAmount ? Number(maturityAmount) : null,
      interestType: interestType || "compound",
      compoundFreq: compoundFreq || "quarterly",
      maturityInstruction: maturityInstruction || null,
      payoutFrequency: payoutFrequency || null,
      nomineeName: nomineeName || null,
      nomineeRelation: nomineeRelation || null,
      notes: notes || null,
      sourceImageUrl: sourceImageUrl || null,
      sourceImageBackUrl: sourceImageBackUrl || null,
    },
  });

  return NextResponse.json({ fd }, { status: 201 });
}
