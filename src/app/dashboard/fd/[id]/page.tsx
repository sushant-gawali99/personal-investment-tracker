import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FDDeleteButton } from "./fd-delete-button";
import { getSessionUserId } from "@/lib/session";

const INSTRUCTION_LABEL: Record<string, string> = {
  renew_principal_interest: "Auto-renew principal + interest",
  renew_principal: "Auto-renew principal, payout interest",
  payout: "Credit to savings on maturity",
};
const FREQUENCY_LABEL: Record<string, string> = {
  on_maturity: "On maturity",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annually: "Annually",
};
function formatInstruction(v: string | null) { return v ? (INSTRUCTION_LABEL[v] ?? v) : "—"; }
function formatFrequency(v: string | null) { return v ? (FREQUENCY_LABEL[v] ?? v) : "—"; }

function computeAccruedInterest(principal: number, rate: number, startDate: Date, asOf: Date, interestType: string, compoundFreq: string | null) {
  const years = Math.max(0, (asOf.getTime() - startDate.getTime()) / (365 * 86400000));
  if (years === 0) return 0;
  if (interestType === "simple") {
    return principal * (rate / 100) * years;
  }
  const n = compoundFreq === "monthly" ? 12 : compoundFreq === "annually" ? 1 : compoundFreq === "half-yearly" ? 2 : 4;
  return principal * (Math.pow(1 + rate / 100 / n, n * years) - 1);
}

export default async function FDDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const fd = await prisma.fixedDeposit.findUnique({
    where: { id },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });
  if (!fd) notFound();
  if (fd.userId && fd.userId !== "" && fd.userId !== userId) notFound();

  const now = new Date();

  // Use latest renewal if present, otherwise use original FD dates/amounts
  const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
  const activePrincipal = latest?.principal ?? fd.principal;
  const activeRate = latest?.interestRate ?? fd.interestRate;
  const activeStart = new Date(latest?.startDate ?? fd.startDate);
  const activeMaturity = new Date(latest?.maturityDate ?? fd.maturityDate);
  const activeTenure = latest?.tenureMonths ?? fd.tenureMonths;
  const activeMaturityAmount = latest?.maturityAmount ?? fd.maturityAmount;
  const activeInstruction = latest?.maturityInstruction ?? fd.maturityInstruction;
  const activeFrequency = latest?.payoutFrequency ?? fd.payoutFrequency;

  const isMatured = activeMaturity <= now;
  const days = daysUntil(activeMaturity);
  const totalDays = (activeMaturity.getTime() - activeStart.getTime()) / 86400000;
  const elapsedDays = Math.max(0, (now.getTime() - activeStart.getTime()) / 86400000);
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const maturityValue = activeMaturityAmount ?? activePrincipal;
  const totalInterest = maturityValue - activePrincipal;
  const accrued = computeAccruedInterest(activePrincipal, activeRate, activeStart, now > activeMaturity ? activeMaturity : now, fd.interestType, fd.compoundFreq);

  const statusBadge = isMatured ? (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#49454e]/30 text-[#cbc4d0] font-headline font-bold">Matured</span>
  ) : days <= 7 ? (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffafd7]/10 text-[#ffafd7] flex items-center gap-1 font-headline font-bold">
      <AlertTriangle size={9} />{days}d left
    </span>
  ) : days <= 30 ? (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-headline font-bold">{days}d left</span>
  ) : (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-headline font-bold">{days}d left</span>
  );

  return (
    <div className="space-y-5">
      <Link href="/dashboard/fd" className="inline-flex items-center gap-1.5 text-xs text-[#cbc4d0] hover:text-[#e4e1e6] transition-colors">
        <ArrowLeft size={12} /> Back to Fixed Deposits
      </Link>

      {/* Header */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#ffafd7]/10 flex items-center justify-center">
              <span className="font-headline font-black text-sm text-[#ffafd7]">
                {fd.bankName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="font-headline font-bold text-lg text-[#e4e1e6]">{fd.bankName}</h1>
              <div className="flex items-center gap-3 mt-1">
                {fd.fdNumber && <span className="text-[11px] text-[#cbc4d0] mono">FD #{fd.fdNumber}</span>}
                {fd.accountNumber && <span className="text-[11px] text-[#cbc4d0] mono">A/c {fd.accountNumber}</span>}
                {fd.renewals.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d2bcfa]/10 text-[#d2bcfa] font-headline font-bold">
                    Renewal #{fd.renewals.length}
                  </span>
                )}
                {statusBadge}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/fd/renew/${fd.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-headline font-bold transition-colors"
            >
              <RefreshCw size={11} /> Renew
            </Link>
            <FDDeleteButton id={fd.id} />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-[#cbc4d0]">{formatDate(activeStart)}</span>
            <span className="text-[#e4e1e6] font-headline font-bold">{activeRate}% p.a. · {fd.interestType}{fd.compoundFreq && fd.interestType === "compound" ? ` (${fd.compoundFreq})` : ""}</span>
            <span className="text-[#cbc4d0]">{formatDate(activeMaturity)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#2a2a2d] overflow-hidden">
            <div
              className={cn("h-full rounded-full", isMatured ? "bg-[#49454e]" : "bg-gradient-to-r from-[#ffafd7]/60 to-[#ffafd7]")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-[#cbc4d0] text-center">
            {activeTenure} months tenure · {isMatured ? "Matured" : `${Math.round(progress)}% elapsed · ${days} days remaining`}
          </p>
        </div>
      </div>

      {/* Amount breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Principal", value: formatINR(activePrincipal), color: "text-[#e4e1e6]" },
          { label: "Accrued Interest", value: formatINR(accrued), color: "text-primary" },
          { label: "Total Interest", value: formatINR(totalInterest), color: "text-primary" },
          { label: "Maturity Value", value: formatINR(maturityValue), color: "text-[#d2bcfa]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1b1b1e] ghost-border rounded-xl p-3.5">
            <p className="text-[#cbc4d0] text-[10px] uppercase tracking-widest font-label mb-1">{label}</p>
            <p className={cn("mono text-lg font-semibold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4 space-y-3">
            <h2 className="font-headline font-bold text-sm text-[#e4e1e6]">Deposit Details</h2>
            <dl className="text-xs space-y-2">
              {[
                ["Bank", fd.bankName],
                ["FD Number", fd.fdNumber ?? "—"],
                ["Account Number", fd.accountNumber ?? "—"],
                ["Interest Type", fd.interestType],
                ["Compound Frequency", fd.interestType === "compound" ? (fd.compoundFreq ?? "—") : "—"],
                ["Tenure", `${activeTenure} months`],
                ["Start Date", formatDate(activeStart)],
                ["Maturity Date", formatDate(activeMaturity)],
                ["Created", formatDate(fd.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1 border-b border-[#49454e]/15 last:border-b-0">
                  <dt className="text-[#cbc4d0]">{k}</dt>
                  <dd className="text-[#e4e1e6] mono text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4 space-y-3">
            <h2 className="font-headline font-bold text-sm text-[#e4e1e6]">Renewal &amp; Nominee</h2>
            <dl className="text-xs space-y-2">
              {[
                ["Maturity Instruction", formatInstruction(activeInstruction)],
                ["Payout Frequency", formatFrequency(activeFrequency)],
                ["Nominee", fd.nomineeName ?? "—"],
                ["Nominee Relation", fd.nomineeRelation ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1 border-b border-[#49454e]/15 last:border-b-0">
                  <dt className="text-[#cbc4d0]">{k}</dt>
                  <dd className="text-[#e4e1e6] mono text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          {fd.notes && (
            <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4">
              <h2 className="font-headline font-bold text-sm text-[#e4e1e6] mb-2">Notes</h2>
              <p className="text-xs text-[#cbc4d0] whitespace-pre-wrap leading-relaxed">{fd.notes}</p>
            </div>
          )}

          <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4">
            <h2 className="font-headline font-bold text-sm text-[#e4e1e6] mb-3">Source Document</h2>
            {fd.sourceImageUrl || fd.sourceImageBackUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { url: fd.sourceImageUrl, label: "Front" },
                  { url: fd.sourceImageBackUrl, label: "Back" },
                ].filter((s) => s.url).map(({ url, label }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label">{label}</p>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:text-[#26fedc] inline-flex items-center gap-1">
                        <FileText size={10} /> Open
                      </a>
                    </div>
                    <a href={url!} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url!} alt={`FD certificate ${label}`} className="rounded-lg w-full h-40 object-contain bg-[#0e0e11] ghost-border" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#cbc4d0]">No document was attached when this FD was added.</p>
            )}
          </div>
        </div>
      </div>

      {/* Renewal history */}
      {fd.renewals.length > 0 && (
        <div className="bg-[#1b1b1e] ghost-border rounded-xl p-4 space-y-3">
          <h2 className="font-headline font-bold text-sm text-[#e4e1e6]">Renewal History</h2>
          <div className="space-y-2">
            {/* Original */}
            <div className="flex items-center justify-between text-xs py-2 border-b border-[#49454e]/15">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#49454e]/30 text-[#cbc4d0] font-headline font-bold">Original</span>
                <span className="text-[#cbc4d0]">{formatDate(fd.startDate)} → {formatDate(fd.maturityDate)}</span>
              </div>
              <div className="text-right">
                <span className="mono text-[#e4e1e6]">{formatINR(fd.principal)}</span>
                <span className="text-[#cbc4d0] ml-2">@ {fd.interestRate}%</span>
              </div>
            </div>
            {fd.renewals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs py-2 border-b border-[#49454e]/15 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d2bcfa]/10 text-[#d2bcfa] font-headline font-bold">R{r.renewalNumber}</span>
                  <span className="text-[#cbc4d0]">{formatDate(r.startDate)} → {formatDate(r.maturityDate)}</span>
                </div>
                <div className="text-right">
                  <span className="mono text-[#e4e1e6]">{formatINR(r.principal)}</span>
                  <span className="text-[#cbc4d0] ml-2">@ {r.interestRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
