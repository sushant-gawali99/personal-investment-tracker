import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { portfolioSummary, fdAccrualTimeline, type Holding, type MFHolding, type FDRecord } from "@/lib/analytics";
import { OverviewClient } from "./overview-client";
import { getSessionUserId } from "@/lib/session";

async function getData(userId: string | null) {
  const [fds, kiteConfig] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where: { OR: [{ userId: userId ?? "" }, { userId: "" }] },
      orderBy: { maturityDate: "asc" },
    }),
    userId ? prisma.kiteConfig.findUnique({ where: { userId } }) : null,
  ]);

  let holdings: Holding[] = [];
  let mfHoldings: MFHolding[] = [];
  if (kiteConfig?.accessToken && kiteConfig.tokenExpiry && new Date(kiteConfig.tokenExpiry) > new Date()) {
    try {
      const kc = createKiteClient(kiteConfig.apiKey);
      kc.setAccessToken(kiteConfig.accessToken);
      [holdings, mfHoldings] = await Promise.all([kc.getHoldings(), kc.getMFHoldings()]);
    } catch {
      // silently fall through — show what we have
    }
  }

  const fdRecords: FDRecord[] = fds.map((fd) => ({
    ...fd,
    compoundFreq: fd.compoundFreq ?? null,
  }));

  const summary = portfolioSummary(holdings, fdRecords, mfHoldings);
  const timeline = fdAccrualTimeline(fdRecords, 24);
  const upcomingMaturities = fdRecords.filter((fd) => new Date(fd.maturityDate) > new Date()).slice(0, 5);

  return { summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected: !!kiteConfig?.accessToken };
}

export default async function OverviewPage() {
  const userId = await getSessionUserId();
  const { summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected } = await getData(userId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-headline font-bold text-base text-[#e4e1e6]">Overview</h1>
        <p className="text-[#cbc4d0] text-xs mt-0.5">Your complete investment portfolio at a glance.</p>
      </div>
      <OverviewClient
        summary={summary}
        timeline={timeline}
        holdings={holdings}
        mfHoldings={mfHoldings}
        upcomingMaturities={upcomingMaturities}
        kiteConnected={kiteConnected}
      />
    </div>
  );
}
