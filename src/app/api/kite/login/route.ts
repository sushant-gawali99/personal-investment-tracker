import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKiteLoginUrl } from "@/lib/kite";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config) {
    return NextResponse.json({ error: "Kite API not configured. Add credentials in Settings." }, { status: 400 });
  }
  const loginUrl = getKiteLoginUrl(config.apiKey);
  return NextResponse.redirect(loginUrl);
}
