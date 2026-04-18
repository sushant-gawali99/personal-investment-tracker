import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    apiKey: config.apiKey,
    connected: !!config.accessToken && !!config.tokenExpiry && new Date(config.tokenExpiry) > new Date(),
  });
}

export async function POST(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { apiKey, apiSecret } = await req.json();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return NextResponse.json({ error: "API key and secret are required" }, { status: 400 });
  }
  await prisma.kiteConfig.upsert({
    where: { userId },
    create: { userId, apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), updatedAt: new Date() },
    update: { apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), accessToken: null, tokenExpiry: null, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  await prisma.kiteConfig.update({
    where: { userId },
    data: { accessToken: null, tokenExpiry: null, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
