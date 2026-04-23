import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof Response) return result;
  const userId = result;

  const { phone } = await req.json();

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, phone: phone ?? null },
    update: { phone: phone ?? null },
  });

  return NextResponse.json({ profile });
}
