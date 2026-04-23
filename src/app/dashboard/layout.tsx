import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin, IMPERSONATE_COOKIE } from "@/lib/session";
import { TopNav } from "@/components/top-nav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;

  // We need the raw impersonated email (not the resolved effective userId from
  // getSessionUserId) so TopNav can display it. Keep this in sync with the
  // impersonation logic in src/lib/session.ts if the cookie name or admin check changes.
  let impersonatedUser: string | undefined;
  if (isSupAdmin(realEmail)) {
    const cookieStore = await cookies();
    impersonatedUser = cookieStore.get(IMPERSONATE_COOKIE)?.value;
  }

  return (
    <div className="min-h-screen bg-[#17171a]">
      <TopNav impersonatedUser={impersonatedUser} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
