import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Sparkles, Cpu,
  TrendingUp, CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, Minus, Circle, ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatDate, formatINR } from "@/lib/format";
import { normalizeBankName } from "@/lib/fd-bank";

const TYPE_META: Record<string, { label: string; icon: typeof TrendingUp; tone: string }> = {
  interest:        { label: "Interest",         icon: TrendingUp,   tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  maturity:        { label: "Maturity",         icon: CheckCircle2, tone: "bg-[#0e2236] text-[#5ba8ff] border-[#173152]" },
  premature_close: { label: "Premature Close",  icon: XCircle,      tone: "bg-[#2a1f0d] text-[#f5a524] border-[#3a2d0f]" },
  transfer_in:     { label: "Transfer In",      icon: ArrowDownLeft,tone: "bg-[#0f2a1f] text-[#5ee0a4] border-[#1a3d2e]" },
  transfer_out:    { label: "Transfer Out",     icon: ArrowUpRight, tone: "bg-[#2a1218] text-[#ff385c] border-[#3a1a22]" },
  tds:             { label: "TDS",              icon: Minus,        tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
  other:           { label: "Other",            icon: Circle,       tone: "bg-[#24242a] text-[#a0a0a5] border-[#2f2f36]" },
};

function bankInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function StatementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const s = await prisma.fDStatement.findFirst({
    where: { id, userId: userId ?? "" },
    include: { transactions: { orderBy: { txnDate: "desc" }, include: { fd: true } } },
  });
  if (!s) notFound();

  const totalInterest = s.transactions.filter((t) => t.type === "interest").reduce((a, t) => a + t.credit, 0);
  const totalTds = s.transactions.filter((t) => t.type === "tds").reduce((a, t) => a + t.debit, 0);
  const unmatched = s.transactions.filter((t) => !t.fdId).length;

  // Flag FDs active during statement period that received no interest credit in this statement
  const bankKey = normalizeBankName(s.bankName);
  const userFds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });
  const periodFrom = s.fromDate ?? new Date(0);
  const periodTo = s.toDate ?? new Date();
  const PERIODIC = new Set(["monthly", "quarterly", "half_yearly", "annually"]);

  const fdsInBank = userFds.filter((f) => !f.disabled && normalizeBankName(f.bankName) === bankKey);
  const fdIdsWithInterest = new Set(
    s.transactions.filter((t) => t.type === "interest" && t.fdId).map((t) => t.fdId as string),
  );

  const missingFds = fdsInBank
    .map((fd) => {
      const latest = fd.renewals.length > 0 ? fd.renewals[fd.renewals.length - 1] : null;
      const startDate = new Date(latest?.startDate ?? fd.startDate);
      const maturityDate = new Date(latest?.maturityDate ?? fd.maturityDate);
      const payoutFrequency = latest?.payoutFrequency ?? fd.payoutFrequency;
      const principal = latest?.principal ?? fd.principal;
      const interestRate = latest?.interestRate ?? fd.interestRate;
      const wasActive = startDate <= periodTo && maturityDate >= periodFrom;
      if (!wasActive) return null;
      const isPeriodic = PERIODIC.has(payoutFrequency ?? "");
      const maturesInPeriod = maturityDate >= periodFrom && maturityDate <= periodTo;
      const expectsCredit = isPeriodic || maturesInPeriod;
      if (!expectsCredit) return null;
      if (fdIdsWithInterest.has(fd.id)) return null;
      return {
        id: fd.id,
        fdNumber: fd.fdNumber,
        accountNumber: fd.accountNumber,
        principal,
        interestRate,
        payoutFrequency,
        maturityDate,
        maturesInPeriod,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/fd/statements"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#a0a0a5] hover:text-[#ededed] transition-colors font-medium"
      >
        <ArrowLeft size={13} /> Back to Bank Statements
      </Link>

      {/* Header */}
      <div className="ab-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
              <span className="font-bold text-[14px] text-[#ff385c]">{bankInitials(s.bankName)}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-[#ededed] tracking-tight truncate">{s.bankName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px] text-[#a0a0a5]">
                <span className="mono">{s.fileName}</span>
                <span className="text-[#6e6e73]">·</span>
                <span>Uploaded {formatDate(s.uploadedAt)}</span>
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                  s.parseMethod === "ai"
                    ? "bg-[#1a1330] text-[#b79dff] border-[#2a2250]"
                    : "bg-[#0e2236] text-[#5ba8ff] border-[#173152]"
                }`}>
                  {s.parseMethod === "ai" ? <Sparkles size={10} /> : <Cpu size={10} />}
                  {s.parseMethod === "ai" ? "AI parsed" : "Regex"}
                </span>
              </div>
            </div>
          </div>
          <a href={`/api/fd/statements/${s.id}/pdf`} className="ab-btn ab-btn-ghost inline-flex items-center gap-1.5">
            <Download size={14} /> Download PDF
          </a>
        </div>
      </div>

      {/* Missing interest warning */}
      {missingFds.length > 0 && (
        <div className="ab-card-flat bg-[#2a1f0d] border-[#3a2d0f] px-5 py-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={18} className="text-[#f5a524] shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-[#f5a524]">
                {missingFds.length} {missingFds.length === 1 ? "FD is" : "FDs are"} missing interest credits
              </p>
              <p className="text-[12px] text-[#a0a0a5] mt-1">
                These FDs were active during the statement period but no interest credit was found for them in this statement.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {missingFds.map((fd) => (
              <Link
                key={fd.id}
                href={`/dashboard/fd/${fd.id}`}
                className="flex items-center justify-between gap-3 bg-[#1a1306] border border-[#3a2d0f] rounded-lg px-3 py-2.5 hover:bg-[#221709] transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#ededed] mono truncate">
                    {fd.fdNumber ?? fd.accountNumber ?? "FD"}
                  </p>
                  <p className="text-[11px] text-[#a0a0a5] mt-0.5">
                    {formatINR(fd.principal)} @ {fd.interestRate}%
                    {fd.payoutFrequency && <> · {fd.payoutFrequency.replace(/_/g, " ")}</>}
                    {fd.maturesInPeriod && <> · matures {formatDate(fd.maturityDate)}</>}
                  </p>
                </div>
                <ExternalLink size={13} className="text-[#6e6e73] group-hover:text-[#f5a524] shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Period" small
          value={s.fromDate ? `${formatDate(s.fromDate)} → ${formatDate(s.toDate!)}` : "—"} />
        <StatTile label="Transactions" value={`${s.matchedCount}/${s.txnCount}`}
          hint={unmatched > 0 ? `${unmatched} unmatched` : "all matched"}
          tone={unmatched > 0 ? "warning" : "success"} />
        <StatTile label="Interest received" value={totalInterest > 0 ? formatINR(totalInterest) : "—"}
          tone={totalInterest > 0 ? "success" : undefined} />
        <StatTile label="TDS" value={totalTds > 0 ? formatINR(totalTds) : "—"} />
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden ab-card overflow-hidden p-0 divide-y divide-[#222226]">
        {s.transactions.map((t) => {
          const meta = TYPE_META[t.type] ?? TYPE_META.other;
          const Icon = meta.icon;
          const isCredit = t.credit > 0;
          const fdLabel = t.fd?.fdNumber ?? t.fd?.accountNumber ?? null;
          return (
            <div key={t.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                    <Icon size={11} />
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[#6e6e73]">{formatDate(t.txnDate)}</span>
                </div>
                <p className="text-[12px] text-[#a0a0a5] mt-1.5 truncate" title={t.particulars}>{t.particulars}</p>
                {t.fd && fdLabel ? (
                  <Link
                    href={`/dashboard/fd/${t.fd.id}`}
                    className="inline-flex items-center gap-1 mt-1 text-[11px] text-[#a0a0a5] hover:text-[#ff385c] mono transition-colors"
                  >
                    {fdLabel} <ExternalLink size={10} className="opacity-60" />
                  </Link>
                ) : (
                  <span className="inline-block mt-1 text-[11px] text-[#6e6e73]">Unmatched</span>
                )}
              </div>
              <span className={`mono text-[14px] font-semibold whitespace-nowrap shrink-0 ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                {isCredit ? "+" : "−"}{formatINR(isCredit ? t.credit : t.debit)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block ab-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#6e6e73] bg-[#17171a] border-b border-[#222226]">
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-left font-medium px-3 py-3">Type</th>
                <th className="text-left font-medium px-3 py-3">Particulars</th>
                <th className="text-right font-medium px-3 py-3">Amount</th>
                <th className="text-left font-medium px-5 py-3">FD</th>
              </tr>
            </thead>
            <tbody>
              {s.transactions.map((t) => {
                const meta = TYPE_META[t.type] ?? TYPE_META.other;
                const Icon = meta.icon;
                const isCredit = t.credit > 0;
                const fdLabel = t.fd?.fdNumber ?? t.fd?.accountNumber ?? null;
                return (
                  <tr key={t.id} className="border-t border-[#222226] hover:bg-[#17171a] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-[#ededed]">{formatDate(t.txnDate)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.tone}`}>
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#a0a0a5] max-w-[40ch] truncate" title={t.particulars}>{t.particulars}</td>
                    <td className={`px-3 py-3 text-right mono font-semibold whitespace-nowrap ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a8a]"}`}>
                      {isCredit ? "+" : "−"}{formatINR(isCredit ? t.credit : t.debit)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {t.fd && fdLabel ? (
                        <Link
                          href={`/dashboard/fd/${t.fd.id}`}
                          className="inline-flex items-center gap-1 text-[#ededed] hover:text-[#ff385c] mono transition-colors"
                          title="Open FD details"
                        >
                          {fdLabel}
                          <ExternalLink size={11} className="opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-[#6e6e73]">Unmatched</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label, value, hint, tone, small,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning";
  small?: boolean;
}) {
  const toneColor =
    tone === "success" ? "text-[#5ee0a4]" :
    tone === "warning" ? "text-[#f5a524]" : "text-[#ededed]";
  return (
    <div className="ab-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#6e6e73] font-medium">{label}</p>
      <p className={`${small ? "text-[13px]" : "text-[18px]"} font-semibold mt-1.5 ${toneColor} mono`}>{value}</p>
      {hint && <p className="text-[11px] text-[#6e6e73] mt-0.5">{hint}</p>}
    </div>
  );
}
