import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { FDReportData } from "@/lib/fd-statement-report/types";

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const reports = await prisma.fDStatementReport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolderName: true,
      statementFromDate: true,
      statementToDate: true,
      statementPdfUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const body = await req.json() as {
    reportData: FDReportData;
    statementPdfUrl?: string;
  };

  const { reportData, statementPdfUrl } = body;
  if (!reportData) {
    return NextResponse.json({ error: "reportData is required" }, { status: 400 });
  }

  const report = await prisma.fDStatementReport.create({
    data: {
      userId,
      bankName: reportData.bankName,
      accountNumber: reportData.accountNumber ?? null,
      accountHolderName: reportData.accountHolderName ?? null,
      statementFromDate: reportData.statementFromDate ? new Date(reportData.statementFromDate) : null,
      statementToDate: reportData.statementToDate ? new Date(reportData.statementToDate) : null,
      statementPdfUrl: statementPdfUrl ?? null,
      reportJson: JSON.stringify(reportData),
    },
  });

  return NextResponse.json({ id: report.id });
}
