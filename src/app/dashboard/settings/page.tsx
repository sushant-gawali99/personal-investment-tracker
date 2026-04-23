import { headers, cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { KiteSettingsForm } from "./kite-settings-form";
import { NotificationSettingsForm } from "./notification-settings-form";
import { CopyableUrl } from "./copyable-url";
import { ImpersonationSelector } from "./impersonation-selector";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, isSupAdmin, IMPERSONATE_COOKIE } from "@/lib/session";

export default async function SettingsPage() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const session = await getServerSession(authOptions);
  const realEmail = session?.user?.email ?? null;
  const isSA = isSupAdmin(realEmail);

  const cookieStore = await cookies();
  const activeUserId = isSA
    ? (cookieStore.get(IMPERSONATE_COOKIE)?.value ?? null)
    : null;

  const userId = await getSessionUserId();
  const config = userId ? await prisma.kiteConfig.findUnique({ where: { userId } }) : null;
  const isConnected =
    !!config?.accessToken &&
    !!config?.tokenExpiry &&
    new Date(config.tokenExpiry) > new Date();

  const profile = userId
    ? await prisma.userProfile.findUnique({ where: { userId } })
    : null;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Settings</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Manage your API credentials and app configuration.</p>
      </div>

      <ImpersonationSelector isSuperAdmin={isSA} activeUserId={activeUserId} />

      <section className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Zerodha / Kite Connect</p>
          <p className="text-[13px] text-[#a0a0a5] mt-2 leading-relaxed">
            Enter your Kite Connect API credentials from{" "}
            <a
              href="https://developers.kite.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
            >
              developers.kite.trade
            </a>
            . Set the redirect URL to{" "}
            <CopyableUrl url={`${baseUrl}/api/kite/callback`} />
          </p>
        </div>
        <KiteSettingsForm
          savedApiKey={config?.apiKey ?? ""}
          isConnected={isConnected}
        />
      </section>

      <section className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Notifications</p>
          <p className="text-[13px] text-[#a0a0a5] mt-2 leading-relaxed">
            FD maturity reminders are sent by email automatically. Add a phone number to also receive WhatsApp reminders.
          </p>
        </div>
        <NotificationSettingsForm savedPhone={profile?.phone ?? null} />
      </section>
    </div>
  );
}
