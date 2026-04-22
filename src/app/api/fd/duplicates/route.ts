import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const MAX_KEYS = 20;

/**
 * GET /api/fd/duplicates?keys=<bank>|<fdNumber>,<bank>|<fdNumber>,...
 * Returns which (bankName, fdNumber) tuples already exist for the current user.
 */
export async function GET(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const raw = req.nextUrl.searchParams.get("keys") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ duplicates: [] });
  }

  const parts = raw.split(",").slice(0, MAX_KEYS);
  const keys = parts
    .map((p) => {
      const pipe = p.indexOf("|");
      if (pipe < 0) return null;
      const bankName = p.slice(0, pipe).trim();
      const fdNumber = p.slice(pipe + 1).trim();
      if (!bankName || !fdNumber) return null;
      return { bankName, fdNumber };
    })
    .filter((k): k is { bankName: string; fdNumber: string } => k !== null);

  if (keys.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  const matches = await prisma.fixedDeposit.findMany({
    where: {
      userId,
      OR: keys.map((k) => ({ bankName: k.bankName, fdNumber: k.fdNumber })),
    },
    select: { bankName: true, fdNumber: true },
  });

  return NextResponse.json({
    duplicates: matches.map((m) => ({
      bankName: m.bankName,
      fdNumber: m.fdNumber,
    })),
  });
}
