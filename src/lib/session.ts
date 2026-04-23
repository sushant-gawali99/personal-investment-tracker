import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export const SUPER_ADMIN_EMAIL = "sushant.gawali@gmail.com";
export const IMPERSONATE_COOKIE = "x-impersonate-user";

export function isSupAdmin(email: string | null): boolean {
  return email === SUPER_ADMIN_EMAIL;
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  if (isSupAdmin(realEmail)) {
    const cookieStore = await cookies();
    const impersonated = cookieStore.get(IMPERSONATE_COOKIE)?.value;
    if (impersonated) return impersonated;
  }
  return realEmail;
}

export async function requireUserId(): Promise<string | NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return userId;
}
