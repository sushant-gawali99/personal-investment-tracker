import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { ZerodhaDashboard } from "./zerodha-dashboard";
import { ConnectKiteBanner } from "./connect-kite-banner";
import { getSessionUserId } from "@/lib/session";

async function getKiteData(userId: string | null) {
  if (!userId) return { status: "not_configured" as const, config: null };

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });

  if (!config?.accessToken) return { status: "not_configured" as const, config };

  const isExpired = config.tokenExpiry && new Date(config.tokenExpiry) < new Date();
  if (isExpired) return { status: "expired" as const, config };

  try {
    const kc = createKiteClient(config.apiKey);
    kc.setAccessToken(config.accessToken);
    const [holdings, positions, mfHoldings] = await Promise.all([
      kc.getHoldings(),
      kc.getPositions(),
      kc.getMFHoldings(),
    ]);
    return { status: "ok" as const, holdings, positions, mfHoldings, config };
  } catch {
    return { status: "error" as const, config };
  }
}

export default async function ZerodhaPage() {
  const userId = await getSessionUserId();
  const data = await getKiteData(userId);

  if (data.status !== "ok") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-headline font-semibold text-lg text-[#e4e1e6] tracking-tight">Zerodha</h1>
          <p className="text-[#cbc4d0] text-xs mt-0.5">Live holdings and positions from your Kite account.</p>
        </div>
        <ConnectKiteBanner status={data.status} hasConfig={!!data.config?.apiKey} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline font-semibold text-lg text-[#e4e1e6] tracking-tight">Zerodha</h1>
        <p className="text-[#cbc4d0] text-xs mt-0.5">Live holdings and positions from your Kite account.</p>
      </div>
      <ZerodhaDashboard holdings={data.holdings} positions={data.positions} mfHoldings={data.mfHoldings} />
    </div>
  );
}
