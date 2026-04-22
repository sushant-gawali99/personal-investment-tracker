import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FDDisableButton } from "../fd-disable-button";
import { FDDetailContent } from "../fd-detail-content";
import { getSessionUserId } from "@/lib/session";

function computeAccruedInterest(principal: number, rate: number, startDate: Date, asOf: Date, interestType: string, compoundFreq: string | null) {
  const years = Math.max(0, (asOf.getTime() - startDate.getTime()) / (365 * 86400000));
  if (years === 0) return 0;
  if (interestType === "simple") {
    return principal * (rate / 100) * years;
  }
  const n = compoundFreq === "monthly" ? 12 : compoundFreq === "annually" ? 1 : compoundFreq === "half-yearly" ? 2 : 4;
  return principal * (Math.pow(1 + rate / 100 / n, n * years) - 1);
}

export default async function FDDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ addPrevious?: string }> }) {
  const { id } = await params;
  const { addPrevious } = await searchParams;
  const userId = await getSessionUserId();
  const fd = await prisma.fixedDeposit.findUnique({
    where: { id },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });
  if (!fd) notFound();
  if (fd.userId && fd.userId !== "" && fd.userId !== userId) notFound();

  const statementTxns = await prisma.fDStatementTxn.findMany({
    where: { fdId: fd.id },
    orderBy: { txnDate: "desc" },
    select: {
      id: true,
      txnDate: true,
      particulars: true,
      debit: true,
      credit: true,
      type: true,
      statementId: true,
    },
  });
  const serializedTxns = statementTxns.map((t) => ({
    ...t,
    txnDate: t.txnDate.toISOString(),
  }));

  const now = new Date();
  const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
  const activePrincipal = latest?.principal ?? fd.principal;
  const activeRate = latest?.interestRate ?? fd.interestRate;
  const activeStart = new Date(latest?.startDate ?? fd.startDate);
  const activeMaturity = new Date(latest?.maturityDate ?? fd.maturityDate);
  const activeMaturityAmount = latest?.maturityAmount ?? fd.maturityAmount;

  const isMatured = activeMaturity <= now;
  const days = daysUntil(activeMaturity);
  const computedTotalInterest = computeAccruedInterest(activePrincipal, activeRate, activeStart, activeMaturity, fd.interestType, fd.compoundFreq);
  const totalInterest = activeMaturityAmount != null ? activeMaturityAmount - activePrincipal : computedTotalInterest;
  const maturityValue = activePrincipal + totalInterest;

  const statusBadge = isMatured ? (
    <span className="ab-chip">Matured</span>
  ) : days <= 7 ? (
    <span className="ab-chip ab-chip-error flex items-center gap-1">
      <AlertTriangle size={10} />{days}d left
    </span>
  ) : days <= 30 ? (
    <span className="ab-chip ab-chip-warning">{days}d left</span>
  ) : (
    <span className="ab-chip ab-chip-success">{days}d left</span>
  );

  return (
    <div className="space-y-5">
      <Link href="/dashboard/fd" className="inline-flex items-center gap-1.5 text-[13px] text-[#a0a0a5] hover:text-[#ededed] transition-colors font-medium">
        <ArrowLeft size={13} /> Back to Fixed Deposits
      </Link>

      {isMatured && (
        <div className="ab-card-flat bg-[#2a1f0d] border-[#3a2d0f] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-[#f5a524] shrink-0" />
            <div>
              <p className="text-[14px] text-[#f5a524] font-semibold">This FD has matured</p>
              <p className="text-[12px] text-[#a0a0a5] mt-0.5">
                Matured on {formatDate(activeMaturity)} · {Math.floor((now.getTime() - activeMaturity.getTime()) / 86400000)} days ago · {formatINR(maturityValue)} available
              </p>
            </div>
          </div>
          {!fd.disabled && (
            <Link
              href={`/dashboard/fd/renew/${fd.id}`}
              className="ab-btn ab-btn-secondary"
            >
              <RefreshCw size={13} /> Renew Now
            </Link>
          )}
        </div>
      )}

      {addPrevious && fd.renewals.length === 0 && (
        <div className="ab-card-flat bg-[#2a1f0d] border-[#3a2d0f] px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[14px] text-[#f5a524] font-semibold">Complete the renewal history</p>
            <p className="text-[12px] text-[#a0a0a5] mt-1 leading-relaxed">
              This FD was previously renewed. Use the <strong className="text-[#ededed]">Renew</strong> button to add each previous renewal in order — starting from the earliest one.
            </p>
          </div>
          <Link
            href={`/dashboard/fd/renew/${id}`}
            className="ab-btn ab-btn-secondary"
          >
            <RefreshCw size={13} /> Add Renewal
          </Link>
        </div>
      )}

      <div className="ab-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
              <span className="font-bold text-[14px] text-[#ff385c]">
                {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className={cn("text-[22px] font-semibold text-[#ededed] tracking-tight")}>{fd.bankName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {fd.fdNumber && <span className="text-[12px] text-[#a0a0a5] mono">FD #{fd.fdNumber}</span>}
                {fd.accountNumber && <span className="text-[12px] text-[#a0a0a5] mono">A/c {fd.accountNumber}</span>}
                {fd.renewals.length > 0 && (
                  <span className="ab-chip ab-chip-accent">
                    Renewal #{fd.renewals.length}
                  </span>
                )}
                {fd.disabled && <span className="ab-chip">Disabled</span>}
                {statusBadge}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!fd.disabled && (
              <Link
                href={`/dashboard/fd/renew/${fd.id}`}
                className="ab-btn ab-btn-secondary"
              >
                <RefreshCw size={13} /> Renew
              </Link>
            )}
            <FDDisableButton id={fd.id} disabled={fd.disabled} />
          </div>
        </div>
      </div>

      <FDDetailContent fd={{ ...fd, txns: serializedTxns }} />
    </div>
  );
}
