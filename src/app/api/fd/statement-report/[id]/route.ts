import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { FDReportData } from "@/lib/fd-statement-report/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;

  const report = await prisma.fDStatementReport.findFirst({
    where: { id, userId },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const reportData = JSON.parse(report.reportJson) as FDReportData;

  return NextResponse.json({
    report: {
      ...report,
      statementFromDate: report.statementFromDate?.toISOString() ?? null,
      statementToDate: report.statementToDate?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      reportData,
      reportJson: undefined,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;

  const report = await prisma.fDStatementReport.findFirst({ where: { id, userId } });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const body = await req.json() as {
    reportData: FDReportData;
    statementPdfUrl?: string;
  };

  const { reportData, statementPdfUrl } = body;

  await prisma.fDStatementReport.update({
    where: { id },
    data: {
      bankName: reportData.bankName,
      accountNumber: reportData.accountNumber ?? null,
      accountHolderName: reportData.accountHolderName ?? null,
      statementFromDate: reportData.statementFromDate ? new Date(reportData.statementFromDate) : null,
      statementToDate: reportData.statementToDate ? new Date(reportData.statementToDate) : null,
      ...(statementPdfUrl ? { statementPdfUrl } : {}),
      reportJson: JSON.stringify(reportData),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { id } = await params;

  const report = await prisma.fDStatementReport.findFirst({ where: { id, userId } });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await prisma.fDStatementReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
