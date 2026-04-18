import { prisma } from "@/lib/prisma";
import { ZerodhaDashboard } from "./zerodha-dashboard";
import { ConnectKiteBanner } from "./connect-kite-banner";
import { getSessionUserId } from "@/lib/session";
import { SyncStatus } from "./sync-status";

async function getKiteData(userId: string | null) {
  if (!userId) return { status: "not_configured" as const, config: null };

  const [config, snapshot] = await Promise.all([
    prisma.kiteConfig.findUnique({ where: { userId } }),
    prisma.kiteSnapshot.findUnique({ where: { userId } }),
  ]);

  if (!config?.accessToken) return { status: "not_configured" as const, config };

  const isExpired = config.tokenExpiry && new Date(config.tokenExpiry) < new Date();
  if (isExpired && !snapshot) return { status: "expired" as const, config };

  if (!snapshot) return { status: "never_synced" as const, config };

  return {
    status: "ok" as const,
    holdings: JSON.parse(snapshot.holdingsJson),
    positions: JSON.parse(snapshot.positionsJson),
    mfHoldings: JSON.parse(snapshot.mfHoldingsJson),
    syncedAt: snapshot.syncedAt,
    sessionExpired: !!isExpired,
    config,
  };
}

export default async function ZerodhaPage() {
  const userId = await getSessionUserId();
  const data = await getKiteData(userId);

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="font-headline font-semibold text-lg text-[#e4e1e6] tracking-tight">Zerodha</h1>
        <p className="text-[#cbc4d0] text-xs mt-0.5">Holdings and positions from your Kite account.</p>
      </div>
      {data.status === "ok" && (
        <SyncStatus syncedAt={data.syncedAt.toISOString()} sessionExpired={data.sessionExpired} />
      )}
      {data.status === "never_synced" && <SyncStatus syncedAt={null} sessionExpired={false} />}
    </div>
  );

  if (data.status === "not_configured" || data.status === "expired") {
    return (
      <div className="space-y-5">
        {header}
        <ConnectKiteBanner status={data.status} hasConfig={!!data.config?.apiKey} />
      </div>
    );
  }

  if (data.status === "never_synced") {
    return (
      <div className="space-y-5">
        {header}
        <div className="bg-[#1b1b1e] ghost-border rounded-xl p-8 text-center">
          <p className="font-headline font-bold text-sm text-[#e4e1e6]">No data yet</p>
          <p className="text-[#cbc4d0] text-xs mt-1">Click &quot;Sync Now&quot; above to fetch your Zerodha holdings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <ZerodhaDashboard holdings={data.holdings} positions={data.positions} mfHoldings={data.mfHoldings} />
    </div>
  );
}
