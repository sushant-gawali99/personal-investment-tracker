import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { linkTransactionsForFd } from "@/lib/fd-link/link-batch";

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
    bankName, branchName, fdNumber, accountNumber, depositorName, depositorSecondName, principal, interestRate,
    tenureMonths, tenureDays, tenureText, startDate, maturityDate, maturityAmount,
    interestType, compoundFreq,
    maturityInstruction, payoutFrequency, nomineeName, nomineeRelation,
    notes, sourceImageUrl, sourceImageBackUrl, sourcePdfUrl,
    renewals, // optional: [{ renewalNumber, startDate, maturityDate, principal, interestRate, tenureMonths, maturityAmount, maturityInstruction, payoutFrequency }]
    overwrite, // if true, update existing duplicate instead of rejecting
  } = body;

  if (!bankName || !principal || !interestRate || !startDate || !maturityDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tenureMonthsNum = Number(tenureMonths) || 0;
  const tenureDaysNum = Number(tenureDays) || 0;
  if (tenureMonthsNum <= 0 && tenureDaysNum <= 0) {
    return NextResponse.json({ error: "Tenure must be greater than 0 (months or days)" }, { status: 400 });
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
  if (duplicate && !overwrite) {
    return NextResponse.json(
      { error: "A Fixed Deposit with the same details already exists." },
      { status: 409 }
    );
  }

  const fdData = {
    userId,
    bankName,
    branchName: branchName || null,
    fdNumber: fdNumber || null,
    accountNumber: accountNumber || null,
    depositorName: depositorName || null,
    depositorSecondName: depositorSecondName || null,
    principal: Number(principal),
    interestRate: Number(interestRate),
    tenureMonths: tenureMonthsNum,
    tenureDays: tenureDaysNum,
    tenureText: typeof tenureText === "string" && tenureText.trim() ? tenureText.trim().slice(0, 100) : null,
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
    sourcePdfUrl: sourcePdfUrl || null,
  };

  const renewalRows = Array.isArray(renewals) ? renewals.filter((r: { startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; tenureDays?: number }) =>
    r.startDate && r.maturityDate && !isNaN(new Date(r.startDate).getTime()) && !isNaN(new Date(r.maturityDate).getTime()) && Number(r.principal) > 0 && Number(r.interestRate) > 0 && ((Number(r.tenureMonths) || 0) > 0 || (Number(r.tenureDays) || 0) > 0)
  ) : [];

  if (duplicate && overwrite) {
    const [fd] = await prisma.$transaction(async (tx) => {
      const updated = await tx.fixedDeposit.update({
        where: { id: duplicate.id },
        data: fdData,
      });
      await tx.fDRenewal.deleteMany({ where: { fdId: duplicate.id } });
      if (renewalRows.length > 0) await tx.fDRenewal.createMany({
        data: renewalRows.map((r: { renewalNumber: number; startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; tenureDays?: number; tenureText?: string | null; maturityAmount?: number; maturityInstruction?: string; payoutFrequency?: string }) => ({
          fdId: updated.id,
          renewalNumber: r.renewalNumber,
          startDate: new Date(r.startDate),
          maturityDate: new Date(r.maturityDate),
          principal: Number(r.principal),
          interestRate: Number(r.interestRate),
          tenureMonths: Number(r.tenureMonths) || 0,
          tenureDays: Number(r.tenureDays) || 0,
          tenureText: typeof r.tenureText === "string" && r.tenureText.trim() ? r.tenureText.trim().slice(0, 100) : null,
          maturityAmount: r.maturityAmount ? Number(r.maturityAmount) : null,
          maturityInstruction: r.maturityInstruction || null,
          payoutFrequency: r.payoutFrequency || null,
        })),
      });
      return [updated];
    });
    try {
      await linkTransactionsForFd(userId, fd.id);
    } catch (err) {
      console.error("fd-link: linkTransactionsForFd failed", err);
    }
    return NextResponse.json({ fd }, { status: 200 });
  }

  const [fd] = await prisma.$transaction(async (tx) => {
    const created = await tx.fixedDeposit.create({ data: fdData });

    if (renewalRows.length > 0) await tx.fDRenewal.createMany({
      data: renewalRows.map((r: { renewalNumber: number; startDate: string; maturityDate: string; principal: number; interestRate: number; tenureMonths: number; tenureDays?: number; tenureText?: string | null; maturityAmount?: number; maturityInstruction?: string; payoutFrequency?: string }) => ({
        fdId: created.id,
        renewalNumber: r.renewalNumber,
        startDate: new Date(r.startDate),
        maturityDate: new Date(r.maturityDate),
        principal: Number(r.principal),
        interestRate: Number(r.interestRate),
        tenureMonths: Number(r.tenureMonths) || 0,
        tenureDays: Number(r.tenureDays) || 0,
        tenureText: typeof r.tenureText === "string" && r.tenureText.trim() ? r.tenureText.trim().slice(0, 100) : null,
        maturityAmount: r.maturityAmount ? Number(r.maturityAmount) : null,
        maturityInstruction: r.maturityInstruction || null,
        payoutFrequency: r.payoutFrequency || null,
      })),
    });

    return [created];
  });

  try {
    await linkTransactionsForFd(userId, fd.id);
  } catch (err) {
    console.error("fd-link: linkTransactionsForFd failed", err);
  }
  return NextResponse.json({ fd }, { status: 201 });
}
