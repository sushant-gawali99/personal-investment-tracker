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

  // Only enforce timeout if the cookie exists. A missing cookie means a fresh
  // login — the client hook hasn't mounted yet and will write it on first render.
  if (!isNaN(lastActivity) && Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
    if (req.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("reason", "timeout");
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    const res = NextResponse.redirect(loginUrl);
    // Delete the stale cookie so re-login lands on a clean slate.
    // Without this, the stale cookie survives the re-auth redirect and
    // immediately triggers another timeout on the first post-login request.
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
