import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { isPatternTooBroad } from "@/lib/bank-accounts/merchant-rules";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Include system-wide rules (userId=null) alongside the user's own.
  const items = await prisma.merchantRule.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: { matchCount: "desc" },
    include: { category: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { pattern, categoryId, createdFromTransactionId } = body as {
    pattern: string; categoryId: string; createdFromTransactionId?: string;
  };
  if (!pattern?.trim() || !categoryId) {
    return NextResponse.json({ error: "pattern and categoryId required" }, { status: 400 });
  }
  const all = await prisma.transaction.findMany({
    where: { userId },
    select: { normalizedDescription: true },
  });
  if (isPatternTooBroad(pattern.trim().toUpperCase(), all.map((a) => a.normalizedDescription))) {
    return NextResponse.json(
      { error: "Pattern is too broad (matches > 50% of your transactions or is too short)" },
      { status: 400 },
    );
  }
  const created = await prisma.merchantRule.create({
    data: {
      userId,
      pattern: pattern.trim().toUpperCase(),
      categoryId,
      createdFromTransactionId: createdFromTransactionId ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
