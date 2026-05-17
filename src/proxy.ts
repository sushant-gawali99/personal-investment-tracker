import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const COOKIE_NAME = "pit-last-activity";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const lastActivityRaw = req.cookies.get(COOKIE_NAME)?.value;
  const lastActivity = Number(lastActivityRaw);

  if (isNaN(lastActivity) || lastActivity > Date.now() || Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
    if (req.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("reason", "timeout");
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
