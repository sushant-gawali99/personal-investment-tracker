import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.transactionCategory.findMany({
    where: { OR: [{ userId: null }, { userId }], disabled: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { name, kind, icon, color, sortOrder } = body as {
    name: string; kind: "expense" | "income" | "transfer"; icon?: string; color?: string; sortOrder?: number;
  };
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const created = await prisma.transactionCategory.create({
    data: {
      userId,
      name: name.trim(),
      kind: kind ?? "expense",
      icon: icon ?? null,
      color: color ?? null,
      sortOrder: sortOrder ?? 500,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
