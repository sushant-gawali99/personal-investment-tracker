import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { findOrCreateFdBank } from "@/lib/fd-bank";

/**
 * GET — list the user's FdBanks, with deposit counts. Used by the bank
 * combobox in FD forms and by the FD list filter dropdown.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const banks = await prisma.fdBank.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      _count: { select: { deposits: true } },
    },
  });

  return NextResponse.json({
    items: banks.map((b) => ({
      id: b.id,
      name: b.name,
      normalizedName: b.normalizedName,
      depositCount: b._count.deposits,
    })),
  });
}

/**
 * POST — find-or-create an FdBank for this user. Body: { name: string }.
 * Used by the combobox when a user types a new bank name.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const bank = await findOrCreateFdBank(prisma, userId, name);
  return NextResponse.json({ bank });
}
