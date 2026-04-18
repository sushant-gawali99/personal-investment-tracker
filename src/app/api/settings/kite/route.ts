import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const config = await prisma.kiteConfig.findUnique({ where: { id: "singleton" } });
  if (!config) return NextResponse.json({ configured: false });
  return NextResponse.json({
    configured: true,
    apiKey: config.apiKey,
    connected: !!config.accessToken && !!config.tokenExpiry && new Date(config.tokenExpiry) > new Date(),
  });
}

export async function POST(req: NextRequest) {
  const { apiKey, apiSecret } = await req.json();
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return NextResponse.json({ error: "API key and secret are required" }, { status: 400 });
  }
  await prisma.kiteConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), updatedAt: new Date() },
    update: { apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), accessToken: null, tokenExpiry: null, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  await prisma.kiteConfig.updateMany({
    data: { accessToken: null, tokenExpiry: null, updatedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
