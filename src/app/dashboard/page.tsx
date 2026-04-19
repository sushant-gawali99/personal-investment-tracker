import { prisma } from "@/lib/prisma";
import { portfolioSummary, fdAccrualTimeline, type Holding, type MFHolding, type FDRecord } from "@/lib/analytics";
import { OverviewClient } from "./overview-client";
import { getSessionUserId } from "@/lib/session";

async function getData(userId: string | null) {
  const [fds, kiteConfig, snapshot] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where: { userId: userId ?? "" },
      orderBy: { maturityDate: "asc" },
      include: { renewals: { orderBy: { renewalNumber: "asc" } } },
    }),
    userId ? prisma.kiteConfig.findUnique({ where: { userId } }) : null,
    userId ? prisma.kiteSnapshot.findUnique({ where: { userId } }) : null,
  ]);

  const holdings: Holding[] = snapshot ? JSON.parse(snapshot.holdingsJson) : [];
  const mfHoldings: MFHolding[] = snapshot ? JSON.parse(snapshot.mfHoldingsJson) : [];

  const fdRecords: FDRecord[] = fds.map((fd) => {
    const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
    return {
      id: fd.id,
      bankName: fd.bankName,
      principal: latest?.principal ?? fd.principal,
      interestRate: latest?.interestRate ?? fd.interestRate,
      tenureMonths: latest?.tenureMonths ?? fd.tenureMonths,
      startDate: latest?.startDate ?? fd.startDate,
      maturityDate: latest?.maturityDate ?? fd.maturityDate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
      interestType: fd.interestType,
      compoundFreq: fd.compoundFreq ?? null,
    };
  });

  const summary = portfolioSummary(holdings, fdRecords, mfHoldings);
  const timeline = fdAccrualTimeline(fdRecords, 24);
  const upcomingMaturities = fdRecords.filter((fd) => new Date(fd.maturityDate) > new Date()).slice(0, 5);

  return { summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected: !!kiteConfig?.accessToken };
}

export default async function OverviewPage() {
  const userId = await getSessionUserId();
  const { summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected } = await getData(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Overview</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Your complete investment portfolio at a glance.</p>
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
