import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  let phone: string | null;
  try {
    ({ phone } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (phone !== null && phone !== undefined && !/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, phone: phone ?? null },
    update: { phone: phone ?? null },
  });

  return NextResponse.json({ profile });
}
