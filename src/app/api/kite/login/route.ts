import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKiteLoginUrl } from "@/lib/kite";

export async function GET() {
  const config = await prisma.kiteConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    return NextResponse.json({ error: "Kite API not configured. Add credentials in Settings." }, { status: 400 });
  }
  const loginUrl = getKiteLoginUrl(config.apiKey);
  return NextResponse.redirect(loginUrl);
}
