import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin, IMPERSONATE_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";

const EIGHT_HOURS = 60 * 60 * 8;

async function assertSuperAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!isSupAdmin(session?.user?.email ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const guard = await assertSuperAdmin();
  if (guard) return guard;

  let body: { userId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, userId, {
    httpOnly: true,
    path: "/",
    maxAge: EIGHT_HOURS,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const guard = await assertSuperAdmin();
  if (guard) return guard;

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);

  return NextResponse.json({ ok: true });
}
