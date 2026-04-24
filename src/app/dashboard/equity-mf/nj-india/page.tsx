import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { NJIndiaClient, type NJStatementSummary, type NJSchemeRow } from "./nj-india-client";

async function getStatements(userId: string | null) {
  if (!userId) return { statements: [] as NJStatementSummary[], latestSchemes: [] as NJSchemeRow[] };
  const rows = await prisma.nJIndiaStatement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const statements: NJStatementSummary[] = rows.map((r) => ({
    id: r.id,
    fileUrl: r.fileUrl,
    fileName: r.fileName,
    reportDate: r.reportDate?.toISOString() ?? null,
    totalInvested: r.totalInvested,
    totalCurrentValue: r.totalCurrentValue,
    totalGainLoss: r.totalGainLoss,
    weightedReturnPct: r.weightedReturnPct,
    absoluteReturnPct: r.absoluteReturnPct,
    schemeCount: r.schemeCount,
    investorName: r.investorName,
    createdAt: r.createdAt.toISOString(),
  }));

  const latest = rows[0];
  let latestSchemes: NJSchemeRow[] = [];
  if (latest) {
    try {
      latestSchemes = JSON.parse(latest.schemesJson);
    } catch {
      latestSchemes = [];
    }
  }

  return { statements, latestSchemes };
}

export default async function NJIndiaPage() {
  const userId = await getSessionUserId();
  const { statements, latestSchemes } = await getStatements(userId);
  return <NJIndiaClient statements={statements} schemes={latestSchemes} />;
}
