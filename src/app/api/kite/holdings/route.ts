import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });

  if (!config?.accessToken) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  if (config.tokenExpiry && new Date(config.tokenExpiry) < new Date()) {
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }

  try {
    const kc = createKiteClient(config.apiKey);
    kc.setAccessToken(config.accessToken);
    const holdings = await kc.getHoldings();
    return NextResponse.json({ holdings });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
