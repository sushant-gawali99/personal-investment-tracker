import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupAdmin, IMPERSONATE_COOKIE } from "@/lib/session";
import { TopNav } from "@/components/top-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;

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
