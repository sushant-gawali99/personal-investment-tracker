import { prisma } from "@/lib/prisma";
import { portfolioSummary, fdAccrualTimeline, type Holding, type MFHolding, type FDRecord } from "@/lib/analytics";
import { OverviewClient } from "./overview-client";
import { getSessionUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

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
      tenureDays: latest?.tenureDays ?? fd.tenureDays,
      tenureText: latest?.tenureText ?? fd.tenureText,
      startDate: latest?.startDate ?? fd.startDate,
      maturityDate: latest?.maturityDate ?? fd.maturityDate,
      maturityAmount: latest?.maturityAmount ?? fd.maturityAmount,
      interestType: fd.interestType,
      compoundFreq: fd.compoundFreq ?? null,
    };
  });

  const summary = portfolioSummary(holdings, fdRecords, mfHoldings);
  const timeline = fdAccrualTimeline(fdRecords, 24);
  const now = new Date();
  const upcomingMaturities = fdRecords.filter((fd) => {
    const d = new Date(fd.maturityDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const fdsByBankMap = fdRecords.reduce<Record<string, number>>((acc, fd) => {
    acc[fd.bankName] = (acc[fd.bankName] ?? 0) + fd.principal;
    return acc;
  }, {});
  const fdsByBank = Object.entries(fdsByBankMap)
    .map(([bankName, total]) => ({ bankName, total }))
    .sort((a, b) => b.total - a.total);

  return {
    summary,
    timeline,
    holdings,
    mfHoldings,
    upcomingMaturities,
    kiteConnected: !!kiteConfig?.accessToken,
    fdsByBank,
  };
}

async function getGoldTotals(userId: string | null) {
  const [goldItems, goldRate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId: userId ?? "", disabled: false } }),
    getTodaysRate(),
  ]);
  let currentValue = 0;
  let invested = 0;
  for (const it of goldItems) {
    if (goldRate) currentValue += valuePerGram(it.karat, goldRate.rate22kPerG, goldRate.rate24kPerG) * it.weightGrams;
    if (it.purchasePrice != null) invested += it.purchasePrice;
  }
  return {
    count: goldItems.length,
    currentValue,
    invested,
    gainLoss: invested > 0 && goldRate ? currentValue - invested : null,
    hasRate: !!goldRate,
  };
}

export default async function OverviewPage() {
  const userId = await getSessionUserId();
  const [{ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected, fdsByBank }, goldTotals] =
    await Promise.all([getData(userId), getGoldTotals(userId)]);

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
        goldTotals={goldTotals}
        fdsByBank={fdsByBank}
        userEmail={userId ?? ""}
      />
    </div>
  );
}
