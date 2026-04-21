import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileText, RefreshCw, CheckCircle2 } from "lucide-react";
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

  const now = new Date();

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
  const computedTotalInterest = computeAccruedInterest(activePrincipal, activeRate, activeStart, activeMaturity, fd.interestType, fd.compoundFreq);
  const totalInterest = activeMaturityAmount != null ? activeMaturityAmount - activePrincipal : computedTotalInterest;
  const maturityValue = activePrincipal + totalInterest;
  const accrued = computeAccruedInterest(activePrincipal, activeRate, activeStart, now > activeMaturity ? activeMaturity : now, fd.interestType, fd.compoundFreq);

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
          <Link
            href={`/dashboard/fd/renew/${fd.id}`}
            className="ab-btn ab-btn-secondary"
          >
            <RefreshCw size={13} /> Renew Now
          </Link>
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
              <h1 className="text-[22px] font-semibold text-[#ededed] tracking-tight">{fd.bankName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {fd.fdNumber && <span className="text-[12px] text-[#a0a0a5] mono">FD #{fd.fdNumber}</span>}
                {fd.accountNumber && <span className="text-[12px] text-[#a0a0a5] mono">A/c {fd.accountNumber}</span>}
                {fd.renewals.length > 0 && (
                  <span className="ab-chip ab-chip-accent">
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
              className="ab-btn ab-btn-secondary"
            >
              <RefreshCw size={13} /> Renew
            </Link>
            <FDDeleteButton id={fd.id} />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-[12px] flex-wrap gap-2">
            <span className="text-[#a0a0a5]">{formatDate(activeStart)}</span>
            <span className="text-[#ededed] font-semibold">{activeRate}% p.a. · {fd.interestType}{fd.compoundFreq && fd.interestType === "compound" ? ` (${fd.compoundFreq})` : ""}</span>
            <span className="text-[#a0a0a5]">{formatDate(activeMaturity)}</span>
          </div>
          <div className="h-2 rounded-full bg-[#222226] overflow-hidden">
            <div
              className={cn("h-full rounded-full", isMatured ? "bg-[#3a3a3f]" : "bg-[#ff385c]")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[12px] text-[#a0a0a5] text-center">
            {activeTenure} months tenure · {isMatured ? "Matured" : `${Math.round(progress)}% elapsed · ${days} days remaining`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Principal", value: formatINR(activePrincipal), cls: "text-[#ededed]" },
          { label: "Accrued Interest", value: formatINR(accrued), cls: "text-[#5ee0a4]" },
          { label: "Total Interest", value: formatINR(totalInterest), cls: "text-[#5ee0a4]" },
          { label: "Maturity Value", value: formatINR(maturityValue), cls: "text-[#ededed]" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="ab-card p-4">
            <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <p className={cn("mono text-[18px] font-semibold", cls)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div className="ab-card p-6 space-y-3">
            <h2 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Deposit Details</h2>
            <dl className="text-[13px] space-y-0">
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
                <div key={k} className="flex items-center justify-between gap-4 py-2.5 border-b border-[#2a2a2e] last:border-b-0">
                  <dt className="text-[#a0a0a5]">{k}</dt>
                  <dd className="text-[#ededed] mono text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="ab-card p-6 space-y-3">
            <h2 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Renewal &amp; Nominee</h2>
            <dl className="text-[13px] space-y-0">
              {[
                ["Maturity Instruction", formatInstruction(activeInstruction)],
                ["Payout Frequency", formatFrequency(activeFrequency)],
                ["Nominee", fd.nomineeName ?? "—"],
                ["Nominee Relation", fd.nomineeRelation ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5 border-b border-[#2a2a2e] last:border-b-0">
                  <dt className="text-[#a0a0a5]">{k}</dt>
                  <dd className="text-[#ededed] mono text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="space-y-5">
          {fd.notes && (
            <div className="ab-card p-6">
              <h2 className="text-[16px] font-semibold text-[#ededed] mb-2 tracking-tight">Notes</h2>
              <p className="text-[13px] text-[#a0a0a5] whitespace-pre-wrap leading-relaxed">{fd.notes}</p>
            </div>
          )}

          <div className="ab-card p-6">
            <h2 className="text-[16px] font-semibold text-[#ededed] mb-4 tracking-tight">Source Document</h2>
            {fd.sourceImageUrl || fd.sourceImageBackUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { url: fd.sourceImageUrl, label: "Front" },
                  { url: fd.sourceImageBackUrl, label: "Back" },
                ].filter((s) => s.url).map(({ url, label }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#ededed] font-semibold underline underline-offset-4 inline-flex items-center gap-1 hover:text-[#ff385c] transition-colors">
                        <FileText size={11} /> Open
                      </a>
                    </div>
                    <a href={url!} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url!} alt={`FD certificate ${label}`} className="rounded-xl w-full h-44 object-contain bg-[#1c1c20] border border-[#2a2a2e]" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#a0a0a5]">No document was attached when this FD was added.</p>
            )}
          </div>
        </div>
      </div>

      {fd.renewals.length > 0 && (
        <div className="ab-card p-6 space-y-4">
          <h2 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Renewal History</h2>
          <div>
            <div className="flex items-center justify-between text-[13px] py-3 border-b border-[#2a2a2e]">
              <div className="flex items-center gap-3">
                <span className="ab-chip">Original</span>
                <span className="text-[#a0a0a5]">{formatDate(fd.startDate)} → {formatDate(fd.maturityDate)}</span>
              </div>
              <div className="text-right">
                <span className="mono text-[#ededed] font-semibold">{formatINR(fd.principal)}</span>
                <span className="text-[#a0a0a5] ml-2">@ {fd.interestRate}%</span>
              </div>
            </div>
            {fd.renewals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-[13px] py-3 border-b border-[#2a2a2e] last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="ab-chip ab-chip-accent">R{r.renewalNumber}</span>
                  <span className="text-[#a0a0a5]">{formatDate(r.startDate)} → {formatDate(r.maturityDate)}</span>
                </div>
                <div className="text-right">
                  <span className="mono text-[#ededed] font-semibold">{formatINR(r.principal)}</span>
                  <span className="text-[#a0a0a5] ml-2">@ {r.interestRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
