import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.bankAccount.findMany({
    where: { userId, disabled: false },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { label, bankName, accountNumberLast4, accountType } = body as {
    label: string; bankName: string; accountNumberLast4?: string; accountType?: string;
  };
  if (!label?.trim() || !bankName?.trim()) {
    return NextResponse.json({ error: "label and bankName required" }, { status: 400 });
  }
  const created = await prisma.bankAccount.create({
    data: {
      userId,
      label: label.trim(),
      bankName: bankName.trim(),
      accountNumberLast4: accountNumberLast4?.trim() || null,
      accountType: accountType ?? "savings",
    },
  });
  return NextResponse.json(created, { status: 201 });
}
