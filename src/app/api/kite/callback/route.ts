import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestToken = searchParams.get("request_token");
  const status = searchParams.get("status");

  if (status !== "success" || !requestToken) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }

  const config = await prisma.kiteConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }

  try {
    const kc = createKiteClient(config.apiKey);
    const session = await kc.generateSession(requestToken, config.apiSecret);
    // Zerodha tokens expire at 03:30 IST next day — set expiry to midnight today to be safe
    const expiry = new Date();
    expiry.setHours(23, 59, 0, 0);

    await prisma.kiteConfig.update({
      where: { id: "singleton" },
      data: { accessToken: session.access_token, tokenExpiry: expiry, updatedAt: new Date() },
    });
    return NextResponse.redirect(new URL("/dashboard/zerodha?kite=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", req.url));
  }
}
