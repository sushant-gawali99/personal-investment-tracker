"use client";

import { AlertTriangle, X } from "lucide-react";
import type { BulkRow } from "./bulk-state";
import { mergedFields } from "./bulk-state";

interface Props {
  rows: BulkRow[];
  onOverride: (ids: string[]) => void;
  onSkip: (ids: string[]) => void;
}

export function BulkConfirmModal({ rows, onOverride, onSkip }: Props) {
  if (rows.length === 0) return null;

  const ids = rows.map((r) => r.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--border)] overflow-hidden"
        style={{ background: "var(--surface-deep)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--accent-warning)" }} />
            <p className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
              {rows.length === 1 ? "FD already exists" : `${rows.length} FDs already exist`}
            </p>
          </div>
          <button
            onClick={() => onSkip(ids)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {rows.length === 1
              ? "The following FD already exists in your account. Do you want to override it with the new data?"
              : "The following FDs already exist in your account. Do you want to override them with the new data?"}
          </p>

          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {rows.map((row) => {
              const f = mergedFields(row);
              return (
                <li
                  key={row.id}
                  className="ab-card-flat px-3 py-2 rounded-lg text-[13px]"
                  style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}
                >
                  <span className="font-medium text-[var(--text-primary)]">{f.bankName || "Unknown Bank"}</span>
                  {f.fdNumber && (
                    <span className="text-[var(--text-secondary)]"> · {f.fdNumber}</span>
                  )}
                  {f.principal && (
                    <span className="text-[var(--text-secondary)]"> · ₹{Number(f.principal).toLocaleString("en-IN")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onSkip(ids)}
            className="ab-btn ab-btn-ghost w-full sm:w-auto"
          >
            Skip {rows.length > 1 ? "all" : ""}
          </button>
          <button
            type="button"
            onClick={() => onOverride(ids)}
            className="ab-btn ab-btn-accent w-full sm:w-auto"
          >
            Override {rows.length > 1 ? "all" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
