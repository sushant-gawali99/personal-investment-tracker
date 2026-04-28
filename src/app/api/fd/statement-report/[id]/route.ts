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
