import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  if (!isSupAdmin(realEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [fds, gold, banks, kite] = await Promise.all([
    prisma.fixedDeposit.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.goldItem.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.bankAccount.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.kiteConfig.findMany({ select: { userId: true }, distinct: ["userId"] }),
  ]);

  const users = [
    ...new Set([...fds, ...gold, ...banks, ...kite].map((r) => r.userId)),
  ].sort();

  return NextResponse.json({ users });
}
