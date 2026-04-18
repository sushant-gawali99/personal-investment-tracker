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
    <div className="max-w-2xl space-y-7">
      <div>
        <h1 className="font-headline font-semibold text-lg text-[#e4e1e6] tracking-tight">Settings</h1>
        <p className="text-[#cbc4d0] text-xs mt-0.5">Manage your API credentials and app configuration.</p>
      </div>

      <section className="space-y-4">
        <div>
          <p className="font-headline font-bold text-sm text-[#e4e1e6]">Zerodha / Kite Connect</p>
          <p className="text-xs text-[#cbc4d0] mt-1 leading-relaxed">
            Enter your Kite Connect API credentials from{" "}
            <a
              href="https://developers.kite.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-[#26fedc] transition-colors"
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
