import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { syncKiteData } from "@/lib/kite-sync";

export async function POST() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config?.accessToken) {
    return NextResponse.json({ error: "Not connected to Zerodha." }, { status: 400 });
  }
  if (config.tokenExpiry && new Date(config.tokenExpiry) < new Date()) {
    return NextResponse.json({ error: "Session expired. Please reconnect." }, { status: 401 });
  }

  try {
    await syncKiteData(userId);
    return NextResponse.json({ syncedAt: new Date() });
  } catch {
    return NextResponse.json({ error: "Failed to sync from Zerodha." }, { status: 500 });
  }
}
