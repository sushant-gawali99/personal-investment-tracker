// src/app/dashboard/bank-accounts/accounts/accounts-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account {
  id: string;
  label: string;
  bankName: string;
  accountNumberLast4: string | null;
  accountType: string;
  disabled: boolean;
  txnCount: number;
  lastTxnDate: string | null;
}

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ label: "", bankName: "", accountNumberLast4: "", accountType: "savings" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <form onSubmit={add} className="ab-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="ab-input" placeholder="Label (e.g. HDFC Savings)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input className="ab-input" placeholder="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          <input className="ab-input" placeholder="Last 4 digits" value={form.accountNumberLast4} onChange={(e) => setForm({ ...form, accountNumberLast4: e.target.value })} />
          <select className="ab-input" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <button disabled={busy} className="ab-btn ab-btn-accent">{busy ? "Adding…" : "Add Account"}</button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      <table className="w-full text-sm ab-card">
        <thead><tr className="text-left text-[#a0a0a5]">
          <th className="p-3">Label</th>
          <th className="p-3">Bank</th>
          <th className="p-3">Type</th>
          <th className="p-3 text-right">Txns</th>
          <th className="p-3">Last Txn</th>
          <th className="p-3">Status</th>
          <th className="p-3">Actions</th>
        </tr></thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-[#2a2a2e]">
              <td className="p-3">{a.label}{a.accountNumberLast4 ? <span className="text-[#a0a0a5]"> ····{a.accountNumberLast4}</span> : null}</td>
              <td className="p-3">{a.bankName}</td>
              <td className="p-3 capitalize">{a.accountType}</td>
              <td className="p-3 text-right">{a.txnCount}</td>
              <td className="p-3">{a.lastTxnDate ? a.lastTxnDate.slice(0, 10) : "—"}</td>
              <td className="p-3">{a.disabled ? "Disabled" : "Active"}</td>
              <td className="p-3 space-x-3">
                <button onClick={() => toggleDisabled(a)} className="underline">{a.disabled ? "Enable" : "Disable"}</button>
                <button onClick={() => remove(a)} className="text-red-500 underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
