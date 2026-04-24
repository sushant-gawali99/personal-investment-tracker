import { prisma } from "@/lib/prisma";
import { portfolioSummary, fdAccrualTimeline, type Holding, type MFHolding, type FDRecord } from "@/lib/analytics";
import { OverviewClient } from "./overview-client";
import { getSessionUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

async function getData(userId: string | null) {
  const [fds, kiteConfig, snapshot, njLatest] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where: { userId: userId ?? "" },
      orderBy: { maturityDate: "asc" },
      include: { renewals: { orderBy: { renewalNumber: "asc" } } },
    }),
    userId ? prisma.kiteConfig.findUnique({ where: { userId } }) : null,
    userId ? prisma.kiteSnapshot.findUnique({ where: { userId } }) : null,
    userId
      ? prisma.nJIndiaStatement.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        })
      : null,
  ]);

  const holdings: Holding[] = snapshot ? JSON.parse(snapshot.holdingsJson) : [];
  const mfHoldings: MFHolding[] = snapshot ? JSON.parse(snapshot.mfHoldingsJson) : [];

  const njTotals = njLatest
    ? {
        invested: njLatest.totalInvested,
        currentValue: njLatest.totalCurrentValue,
        gainLoss: njLatest.totalGainLoss,
        xirrPct: njLatest.weightedReturnPct,
        schemeCount: njLatest.schemeCount,
        reportDate: njLatest.reportDate?.toISOString() ?? njLatest.createdAt.toISOString(),
      }
    : null;

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

  const normBank = (s: string) => s.split(/\s+/).slice(0, 2).join(' ')
  const fdsByBankMap = fdRecords.reduce<Record<string, number>>((acc, fd) => {
    const key = normBank(fd.bankName)
    acc[key] = (acc[key] ?? 0) + fd.principal;
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
    njTotals,
  };
}

async function getBankBalances(userId: string | null) {
  if (!userId) return [] as { id: string; label: string; bankName: string; closingBalance: number | null; asOf: string | null }[];
  const [accounts, latestImports] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { userId, disabled: false },
      orderBy: { label: "asc" },
      select: { id: true, label: true, bankName: true },
    }),
    prisma.statementImport.findMany({
      where: { userId, status: "saved", closingBalance: { not: null } },
      orderBy: [{ statementPeriodEnd: "desc" }, { createdAt: "desc" }],
      select: { accountId: true, closingBalance: true, statementPeriodEnd: true, createdAt: true },
    }),
  ]);
  const latest = new Map<string, { closingBalance: number; asOf: string }>();
  for (const imp of latestImports) {
    if (latest.has(imp.accountId)) continue;
    latest.set(imp.accountId, {
      closingBalance: imp.closingBalance!,
      asOf: (imp.statementPeriodEnd ?? imp.createdAt).toISOString(),
    });
  }
  return accounts.map((a) => ({
    id: a.id,
    label: a.label,
    bankName: a.bankName,
    closingBalance: latest.get(a.id)?.closingBalance ?? null,
    asOf: latest.get(a.id)?.asOf ?? null,
  }));
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
  const [{ summary, timeline, holdings, mfHoldings, upcomingMaturities, kiteConnected, fdsByBank, njTotals }, goldTotals, bankBalances] =
    await Promise.all([getData(userId), getGoldTotals(userId), getBankBalances(userId)]);

  return (
    <OverviewClient
        summary={summary}
        timeline={timeline}
        holdings={holdings}
        mfHoldings={mfHoldings}
        upcomingMaturities={upcomingMaturities}
        kiteConnected={kiteConnected}
        goldTotals={goldTotals}
        fdsByBank={fdsByBank}
        bankBalances={bankBalances}
        njTotals={njTotals}
        userEmail={userId ?? ""}
      />
  );
}
