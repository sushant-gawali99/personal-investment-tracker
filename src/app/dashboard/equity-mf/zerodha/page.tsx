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
    <div className="flex items-center justify-end gap-4 flex-wrap">
      {data.status === "ok" && (
        <SyncStatus syncedAt={data.syncedAt.toISOString()} sessionExpired={data.sessionExpired} />
      )}
      {data.status === "never_synced" && <SyncStatus syncedAt={null} sessionExpired={false} />}
    </div>
  );

  if (data.status === "not_configured" || data.status === "expired") {
    return (
      <div className="space-y-6">
        {header}
        <ConnectKiteBanner status={data.status} hasConfig={!!data.config?.apiKey} />
      </div>
    );
  }

  if (data.status === "never_synced") {
    return (
      <div className="space-y-6">
        {header}
        <div className="ab-card p-10 text-center">
          <p className="text-[16px] font-semibold text-[#ededed]">No data yet</p>
          <p className="text-[14px] text-[#a0a0a5] mt-1.5">Click &quot;Sync Now&quot; above to fetch your Zerodha holdings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <ZerodhaDashboard holdings={data.holdings} positions={data.positions} mfHoldings={data.mfHoldings} />
    </div>
  );
}
