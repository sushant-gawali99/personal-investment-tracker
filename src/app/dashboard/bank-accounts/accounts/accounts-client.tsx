// src/app/dashboard/bank-accounts/accounts/accounts-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

interface Account {
  id: string;
  label: string;
  bankName: string;
  accountNumberLast4: string | null;
  accountType: string;
  disabled: boolean;
  txnCount: number;
  lastTxnDate: string | null;
  closingBalance: number | null;
  balanceAsOf: string | null;
}

/** Stable accent color per bank name. */
function bankAccent(bankName: string): { bg: string; fg: string; border: string } {
  const key = (bankName ?? "").toLowerCase();
  if (key.includes("hdfc")) return { bg: "rgba(0,79,159,0.15)", fg: "#5aa9ff", border: "rgba(0,79,159,0.35)" };
  if (key.includes("axis")) return { bg: "rgba(174,35,61,0.15)", fg: "#ff7a8a", border: "rgba(174,35,61,0.35)" };
  if (key.includes("icici")) return { bg: "rgba(175,27,45,0.15)", fg: "#ff8074", border: "rgba(175,27,45,0.35)" };
  if (key.includes("sbi") || key.includes("state bank")) return { bg: "rgba(30,77,163,0.15)", fg: "#7ab8ff", border: "rgba(30,77,163,0.35)" };
  if (key.includes("kotak")) return { bg: "rgba(208,29,47,0.15)", fg: "#ff8090", border: "rgba(208,29,47,0.35)" };
  if (key.includes("idfc")) return { bg: "rgba(234,60,83,0.15)", fg: "#ff7a90", border: "rgba(234,60,83,0.35)" };
  // Default: accent primary
  return { bg: "rgba(255,56,92,0.12)", fg: "#ff385c", border: "rgba(255,56,92,0.25)" };
}

function typeBadgeClass(t: string): string {
  switch (t) {
    case "savings": return "ab-chip-info";
    case "current": return "ab-chip-success";
    case "credit": return "ab-chip-warning";
    default: return "";
  }
}

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ label: "", bankName: "", accountNumberLast4: "", accountType: "savings" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/bank-accounts/accounts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ label: "", bankName: "", accountNumberLast4: "", accountType: "savings" });
    setShowForm(false);
    router.refresh();
  }

  async function toggleDisabled(a: Account) {
    await fetch(`/api/bank-accounts/accounts/${a.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled: !a.disabled }),
    });
    router.refresh();
  }

  async function remove(a: Account) {
    if (a.txnCount > 0) { alert("Disable instead — account has transactions."); return; }
    if (!confirm(`Delete ${a.label}?`)) return;
    await fetch(`/api/bank-accounts/accounts/${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[14px] text-[#a0a0a5]">
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
            {" · "}
            {accounts.filter((a) => !a.disabled).length} active
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={showForm ? "ab-btn ab-btn-ghost" : "ab-btn ab-btn-accent"}
        >
          <Plus size={14} /> {showForm ? "Cancel" : "Add Account"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="ab-card p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[#ededed]">New account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="ab-label">Label</label>
              <input
                className="ab-input"
                placeholder="e.g. HDFC Savings"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div>
              <label className="ab-label">Bank name</label>
              <input
                className="ab-input"
                placeholder="e.g. HDFC Bank"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="ab-label">Last 4 digits</label>
              <input
                className="ab-input"
                placeholder="1234"
                maxLength={4}
                value={form.accountNumberLast4}
                onChange={(e) => setForm({ ...form, accountNumberLast4: e.target.value })}
              />
            </div>
            <div>
              <label className="ab-label">Account type</label>
              <select className="ab-input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button disabled={busy} className="ab-btn ab-btn-accent w-full sm:w-auto">
              {busy ? "Adding…" : "Save Account"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="ab-btn ab-btn-ghost w-full sm:w-auto">
              Cancel
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 text-[13px] text-[#ff7a6e]">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="ab-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-4">
            <Building2 size={22} className="text-[#ff385c]" />
          </div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">No accounts yet</p>
          <p className="text-[13px] text-[#a0a0a5] mt-1 mb-4">Add a bank account to start importing statements.</p>
          <button onClick={() => setShowForm(true)} className="ab-btn ab-btn-accent inline-flex">
            <Plus size={14} /> Add First Account
          </button>
        </div>
      ) : (
        <div className="ab-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#2a2a2e] bg-[#1c1c20] text-left">
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73]">Account</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] hidden sm:table-cell">Type</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] hidden md:table-cell">Number</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] text-right">Balance</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] text-right hidden sm:table-cell">Txns</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] hidden lg:table-cell">Last Txn</th>
                  <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] hidden sm:table-cell">Status</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const accent = bankAccent(a.bankName);
                  return (
                    <tr
                      key={a.id}
                      className={`border-t border-[#2a2a2e] hover:bg-[#1c1c20]/60 transition-colors group ${a.disabled ? "opacity-50" : ""}`}
                    >
                      {/* Account name + bank */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3.5">
                          <span
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: accent.bg, color: accent.fg }}
                          >
                            <CreditCard size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#ededed] truncate">{a.label}</p>
                            <p className="text-[12px] text-[#6e6e73] truncate mt-0.5">{a.bankName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className={`ab-chip ${typeBadgeClass(a.accountType)}`}>
                          {a.accountType}
                        </span>
                      </td>

                      {/* Account number */}
                      <td className="px-5 py-4 hidden md:table-cell">
                        {a.accountNumberLast4 ? (
                          <span className="mono text-[13px] text-[#a0a0a5] tracking-widest">
                            ···· {a.accountNumberLast4}
                          </span>
                        ) : (
                          <span className="text-[#3a3a3e]">—</span>
                        )}
                      </td>

                      {/* Balance */}
                      <td className="px-5 py-4 text-right">
                        {a.closingBalance != null ? (
                          <div>
                            <p className={`mono text-[14px] font-semibold ${a.closingBalance >= 0 ? "text-[#ededed]" : "text-[#ff7a6e]"}`}>
                              {formatINR(a.closingBalance)}
                            </p>
                            {a.balanceAsOf && (
                              <p className="text-[11px] text-[#6e6e73] mt-0.5">
                                {formatDate(a.balanceAsOf)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#3a3a3e]">—</span>
                        )}
                      </td>

                      {/* Txn count */}
                      <td className="px-5 py-4 text-right hidden sm:table-cell">
                        <span className="mono text-[14px] font-semibold text-[#ededed]">{a.txnCount}</span>
                      </td>

                      {/* Last txn */}
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-[13px] text-[#a0a0a5]">
                          {a.lastTxnDate ? formatDate(a.lastTxnDate) : "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span
                          className={`ab-chip ${a.disabled ? "" : "ab-chip-success"}`}
                          style={a.disabled ? { background: "#222226", color: "#a0a0a5" } : undefined}
                        >
                          {a.disabled ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                          {a.disabled ? "Disabled" : "Active"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleDisabled(a)}
                            className="p-2 rounded-lg text-[#6e6e73] hover:text-[#ededed] hover:bg-[#2a2a2e] transition-colors"
                            title={a.disabled ? "Enable" : "Disable"}
                          >
                            {a.disabled ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            onClick={() => remove(a)}
                            className="p-2 rounded-lg text-[#6e6e73] hover:text-[#ff7a6e] hover:bg-[rgba(255,122,110,0.08)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={a.txnCount > 0 ? "Can't delete — has transactions" : "Delete"}
                            disabled={a.txnCount > 0}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
