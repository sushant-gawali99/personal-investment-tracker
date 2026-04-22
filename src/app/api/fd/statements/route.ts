import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { TxnType } from "@/lib/fd-statement/types";

interface SaveTxn {
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
  fdId: string | null;
  skip?: boolean;
}

interface SavePayload {
  bankName: string;
  fileName: string;
  sourcePdfUrl: string;
  fromDate: string | null;
  toDate: string | null;
  parseMethod: "regex" | "ai";
  txns: SaveTxn[];
}

export async function POST(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const body = (await req.json()) as SavePayload;
  const kept = body.txns.filter((t) => !t.skip);

  const statement = await prisma.fDStatement.create({
    data: {
      userId,
      bankName: body.bankName,
      fileName: body.fileName,
      sourcePdfUrl: body.sourcePdfUrl,
      fromDate: body.fromDate ? new Date(body.fromDate) : null,
      toDate: body.toDate ? new Date(body.toDate) : null,
      parseMethod: body.parseMethod,
      txnCount: kept.length,
      matchedCount: kept.filter((t) => t.fdId).length,
    },
  });

  let inserted = 0;
  let skipped = 0;
  for (const t of kept) {
    try {
      await prisma.fDStatementTxn.create({
        data: {
          statementId: statement.id,
          fdId: t.fdId,
          txnDate: new Date(t.txnDate),
          particulars: t.particulars,
          debit: t.debit,
          credit: t.credit,
          type: t.type,
          detectedFdNumber: t.detectedFdNumber,
        },
      });
      inserted++;
    } catch {
      skipped++;
    }
  }
  return NextResponse.json({ statementId: statement.id, inserted, skipped });
}

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;
  const list = await prisma.fDStatement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true, bankName: true, fileName: true, fromDate: true, toDate: true,
      txnCount: true, matchedCount: true, uploadedAt: true, parseMethod: true,
    },
  });
  return NextResponse.json(list);
}
