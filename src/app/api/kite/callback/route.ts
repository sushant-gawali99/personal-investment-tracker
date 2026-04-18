import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestToken = searchParams.get("request_token");
  const status = searchParams.get("status");

  if (status !== "success" || !requestToken) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }

  try {
    const kc = createKiteClient(config.apiKey);
    const session = await kc.generateSession(requestToken, config.apiSecret);
    const expiry = new Date();
    expiry.setHours(23, 59, 0, 0);

    await prisma.kiteConfig.update({
      where: { userId },
      data: { accessToken: session.access_token, tokenExpiry: expiry, updatedAt: new Date() },
    });
    return NextResponse.redirect(new URL("/dashboard/zerodha?kite=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }
}
