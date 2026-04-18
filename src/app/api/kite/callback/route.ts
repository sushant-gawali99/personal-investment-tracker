import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { getSessionUserId } from "@/lib/session";

function publicBaseUrl(req: NextRequest): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestToken = searchParams.get("request_token");
  const status = searchParams.get("status");
  const base = publicBaseUrl(req);

  if (status !== "success" || !requestToken) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", base));
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config) {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", base));
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
    return NextResponse.redirect(new URL("/dashboard/zerodha?kite=connected", base));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?kite=error", base));
  }
}
