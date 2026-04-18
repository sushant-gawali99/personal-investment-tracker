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
    notes, sourceImageUrl, sourceImageBackUrl,
    renewals, // optional: [{ renewalNumber, startDate, maturityDate, principal, interestRate, tenureMonths, maturityAmount, maturityInstruction, payoutFrequency }]
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

  const [fd] = await prisma.$transaction(async (tx) => {
    const created = await tx.fixedDeposit.create({
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

    if (Array.isArray(renewals) && renewals.length > 0) {
      const validRenewals = renewals.filter((r: { startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number }) =>
        r.startDate && r.maturityDate && !isNaN(new Date(r.startDate).getTime()) && !isNaN(new Date(r.maturityDate).getTime()) && Number(r.principal) > 0 && Number(r.interestRate) > 0 && Number(r.tenureMonths) > 0
      );
      if (validRenewals.length > 0) await tx.fDRenewal.createMany({
        data: validRenewals.map((r: { renewalNumber: number; startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; maturityAmount?: number; maturityInstruction?: string; payoutFrequency?: string }) => ({
          fdId: created.id,
          renewalNumber: r.renewalNumber,
          startDate: new Date(r.startDate),
          maturityDate: new Date(r.maturityDate),
          principal: Number(r.principal),
          interestRate: Number(r.interestRate),
          tenureMonths: Number(r.tenureMonths),
          maturityAmount: r.maturityAmount ? Number(r.maturityAmount) : null,
          maturityInstruction: r.maturityInstruction || null,
          payoutFrequency: r.payoutFrequency || null,
        })),
      });
    }

    return [created];
  });

  return NextResponse.json({ fd }, { status: 201 });
}
