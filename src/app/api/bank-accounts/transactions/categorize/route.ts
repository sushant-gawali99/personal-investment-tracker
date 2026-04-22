import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { isPatternTooBroad } from "@/lib/bank-accounts/merchant-rules";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as {
    transactionIds: string[];
    categoryId: string;
    createRule?: { pattern: string };
    recategorizePast?: boolean;
  };
  if (!body.transactionIds?.length || !body.categoryId) {
    return NextResponse.json({ error: "transactionIds and categoryId required" }, { status: 400 });
  }

  await prisma.transaction.updateMany({
    where: { id: { in: body.transactionIds }, userId },
    data: { categoryId: body.categoryId, categorySource: "user" },
  });

  let ruleCreated: string | null = null;
  let reappliedCount = 0;

  if (body.createRule?.pattern) {
    const all = await prisma.transaction.findMany({
      where: { userId }, select: { normalizedDescription: true },
    });
    const pattern = body.createRule.pattern.trim().toUpperCase();
    if (isPatternTooBroad(pattern, all.map((a) => a.normalizedDescription))) {
      return NextResponse.json({ error: "Pattern is too broad" }, { status: 400 });
    }
    const rule = await prisma.merchantRule.create({
      data: {
        userId,
        pattern,
        categoryId: body.categoryId,
        createdFromTransactionId: body.transactionIds[0],
      },
    });
    ruleCreated = rule.id;

    if (body.recategorizePast) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "%");
      const res = await prisma.transaction.updateMany({
        where: {
          userId,
          normalizedDescription: { contains: pattern.replace(/\*/g, "") },
          categorySource: { not: "user" },
        },
        data: { categoryId: body.categoryId, categorySource: "rule" },
      });
      reappliedCount = res.count;
      void escaped;
    }
  }

  return NextResponse.json({ ruleCreated, reappliedCount });
}
