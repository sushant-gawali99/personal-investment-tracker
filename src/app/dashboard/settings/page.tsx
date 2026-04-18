import { KiteSettingsForm } from "./kite-settings-form";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export default async function SettingsPage() {
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
            <code className="text-xs bg-[#1b1b1e] px-1.5 py-0.5 rounded mono text-[#d2bcfa]">
              http://localhost:3001/api/kite/callback
            </code>
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
