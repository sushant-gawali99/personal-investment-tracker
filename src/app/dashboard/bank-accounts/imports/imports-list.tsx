// src/app/dashboard/bank-accounts/imports/imports-list.tsx
"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";

import { formatDate } from "@/lib/format";

interface Item {
  id: string; fileName: string; status: string;
  account: { id: string; label: string };
  statementPeriodStart: string | null; statementPeriodEnd: string | null;
  extractedCount: number; newCount: number; duplicateCount: number;
  claudeCostUsd: number | null;
  createdAt: string;
  errorMessage: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "saved":
      return { chip: "ab-chip-success", icon: <CheckCircle2 size={11} />, label: "Saved" };
    case "preview":
      return { chip: "ab-chip-info", icon: <Clock size={11} />, label: "Needs review" };
    case "extracting":
      return { chip: "ab-chip-warning", icon: <Loader2 size={11} className="animate-spin" />, label: "Extracting" };
    case "failed":
      return { chip: "ab-chip-error", icon: <AlertCircle size={11} />, label: "Failed" };
    case "pending":
    default:
      return { chip: "", icon: <Clock size={11} />, label: "Pending" };
  }
}

export function ImportsList({ items }: { items: Item[] }) {
  const router = useRouter();
  async function remove(id: string) {
    if (!confirm("Delete this import and all its saved transactions?")) return;
    await fetch(`/api/bank-accounts/import/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="ab-card p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-4">
          <Inbox size={22} className="text-[#ff385c]" />
        </div>
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No imports yet</p>
        <p className="text-[13px] text-[#a0a0a5] mt-1 mb-4">Upload your first bank statement PDF to get started.</p>
        <a href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent inline-flex">
          Import Statement
        </a>
      </div>
    );
  }

  return (
    <div className="ab-card overflow-hidden">
      <ul className="divide-y divide-[#2a2a2e]">
        {items.map((i) => {
          const badge = statusBadge(i.status);
          const txnsHref = (() => {
            if (i.status !== "saved" || i.newCount === 0) return null;
            const p = new URLSearchParams({ accountId: i.account.id });
            if (i.statementPeriodStart) p.set("from", i.statementPeriodStart.slice(0, 10));
            if (i.statementPeriodEnd)   p.set("to",   i.statementPeriodEnd.slice(0, 10));
            return `/dashboard/bank-accounts/list?${p}`;
          })();
          return (
            <li key={i.id} className="px-4 py-2.5 hover:bg-[#1c1c20]/50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={14} className="text-[#ff385c] shrink-0" />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-[#ededed] truncate max-w-[180px] sm:max-w-[320px]">
                      {i.fileName}
                    </span>
                    <span className={`ab-chip ${badge.chip}`} style={{ fontSize: 10, padding: "1px 7px" }}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-[#6e6e73]">
                    <span>{i.account.label}</span>
                    <span>·</span>
                    <span>
                      {i.statementPeriodStart
                        ? `${formatDate(i.statementPeriodStart)} → ${i.statementPeriodEnd ? formatDate(i.statementPeriodEnd) : "?"}`
                        : "Period unknown"}
                    </span>
                    <span>·</span>
                    <span>Uploaded {formatDate(i.createdAt)}</span>
                  </div>
                  {i.errorMessage && (
                    <p className="text-[11px] text-[#ff7a6e] mt-1 break-words line-clamp-2">
                      {i.errorMessage}
                    </p>
                  )}
                </div>

                {/* Txn count + view link */}
                <div className="text-right shrink-0">
                  <p className="mono text-[13px] font-semibold text-[#ededed] leading-none">
                    {i.newCount}
                    {i.extractedCount > 0 && (
                      <span className="text-[#6e6e73] font-normal text-[11px]"> / {i.extractedCount}</span>
                    )}
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    {i.duplicateCount > 0 && (
                      <span className="text-[10px] text-[#6e6e73]">{i.duplicateCount} dup</span>
                    )}
                    {txnsHref && (
                      <Link href={txnsHref} className="text-[10px] text-[#ff385c] hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => remove(i.id)}
                  className="p-1.5 rounded-lg text-[#6e6e73] hover:text-[#ff7a6e] hover:bg-[rgba(255,122,110,0.08)] transition-colors shrink-0"
                  title="Delete import"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
