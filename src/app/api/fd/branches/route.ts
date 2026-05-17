import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { findOrCreateFdBranch } from "@/lib/fd-bank";

/**
 * GET — list FdBranches for a given bank (bankId query param).
 * Used by the branch combobox once a bank has been chosen.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bankId = req.nextUrl.searchParams.get("bankId");
  if (!bankId) return NextResponse.json({ items: [] });

  // Guard: only return branches whose parent bank belongs to this user.
  const bank = await prisma.fdBank.findUnique({ where: { id: bankId }, select: { userId: true } });
  if (!bank || bank.userId !== userId) return NextResponse.json({ items: [] });

  const branches = await prisma.fdBranch.findMany({
    where: { bankId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      _count: { select: { deposits: true } },
    },
  });

  return NextResponse.json({
    items: branches.map((b) => ({
      id: b.id,
      name: b.name,
      normalizedName: b.normalizedName,
      depositCount: b._count.deposits,
    })),
  });
}

/**
 * POST — find-or-create an FdBranch within a bank. Body: { bankId, name }.
 * Used by the combobox when the user types a new branch name.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bankId = typeof body?.bankId === "string" ? body.bankId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!bankId || !name) return NextResponse.json({ error: "bankId and name are required" }, { status: 400 });

  // Verify the bank belongs to this user before letting them attach branches to it.
  const bank = await prisma.fdBank.findUnique({ where: { id: bankId }, select: { userId: true } });
  if (!bank || bank.userId !== userId) return NextResponse.json({ error: "Bank not found" }, { status: 404 });

  const branch = await findOrCreateFdBranch(prisma, userId, bankId, name);
  return NextResponse.json({ branch });
}
