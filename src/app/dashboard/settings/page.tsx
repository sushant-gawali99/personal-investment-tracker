import { headers } from "next/headers";
import { KiteSettingsForm } from "./kite-settings-form";
import { CopyableUrl } from "./copyable-url";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export default async function SettingsPage() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const userId = await getSessionUserId();
  const config = userId ? await prisma.kiteConfig.findUnique({ where: { userId } }) : null;
  const isConnected =
    !!config?.accessToken &&
    !!config?.tokenExpiry &&
    new Date(config.tokenExpiry) > new Date();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-[28px] font-bold text-[#222222] tracking-tight">Settings</h1>
        <p className="text-[14px] text-[#6a6a6a] mt-1">Manage your API credentials and app configuration.</p>
      </div>

      <section className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#222222] tracking-tight">Zerodha / Kite Connect</p>
          <p className="text-[13px] text-[#6a6a6a] mt-2 leading-relaxed">
            Enter your Kite Connect API credentials from{" "}
            <a
              href="https://developers.kite.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#222222] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
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
    </div>
  );
}
