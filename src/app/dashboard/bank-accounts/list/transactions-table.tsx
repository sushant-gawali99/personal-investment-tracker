"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Row {
  id: string;
  txnDate: string;
  description: string;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; label: string };
  notes: string | null;
}

export function TransactionsTable({
  accounts, categories,
}: { accounts: { id: string; label: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(sp.get("page") ?? "1"));

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const accountId = sp.get("accountId") ?? "";
  const categoryId = sp.get("categoryId") ?? "";
  const direction = sp.get("direction") ?? "";
  const q = sp.get("q") ?? "";

  const fetchRows = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (direction) params.set("direction", direction);
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", "50");
    const r = await fetch(`/api/bank-accounts/transactions?${params}`);
    if (!r.ok) return;
    const data = await r.json() as { items: Row[]; total: number };
    setRows(data.items);
    setTotal(data.total);
  }, [from, to, accountId, categoryId, direction, q, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value); else next.delete(key);
    next.set("page", "1");
    setPage(1);
    router.replace(`?${next.toString()}`);
  }

  async function updateCategory(id: string, newCategoryId: string) {
    const r = await fetch(`/api/bank-accounts/transactions/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: newCategoryId || null }),
    });
    if (!r.ok) return;
    const row = rows.find((x) => x.id === id);
    if (row && newCategoryId) {
      const pattern = window.prompt(
        "Create a merchant rule?",
        row.description.replace(/\d{6,}/g, "").trim().toUpperCase(),
      );
      if (pattern) {
        const also = confirm("Also re-categorize past transactions matching this pattern?");
        await fetch("/api/bank-accounts/transactions/categorize", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transactionIds: [id],
            categoryId: newCategoryId,
            createRule: { pattern },
            recategorizePast: also,
          }),
        });
      }
    }
    fetchRows();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input className="ab-input" type="date" value={from} onChange={(e) => updateFilter("from", e.target.value)} />
        <input className="ab-input" type="date" value={to} onChange={(e) => updateFilter("to", e.target.value)} />
        <select className="ab-input" value={accountId} onChange={(e) => updateFilter("accountId", e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select className="ab-input" value={categoryId} onChange={(e) => updateFilter("categoryId", e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="ab-input" value={direction} onChange={(e) => updateFilter("direction", e.target.value)}>
          <option value="">Both</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <input className="ab-input" placeholder="Search description" value={q} onChange={(e) => updateFilter("q", e.target.value)} />
      </div>

      <table className="w-full text-sm ab-card">
        <thead><tr className="text-left text-[#a0a0a5]">
          <th className="p-3">Date</th><th className="p-3">Description</th>
          <th className="p-3">Account</th><th className="p-3">Category</th>
          <th className="p-3 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#2a2a2e]">
              <td className="p-3">{r.txnDate.slice(0, 10)}</td>
              <td className="p-3">{r.description}</td>
              <td className="p-3">{r.account.label}</td>
              <td className="p-3">
                <select className="ab-input" value={r.categoryId ?? ""} onChange={(e) => updateCategory(r.id, e.target.value)}>
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td className={`p-3 text-right ${r.direction === "credit" ? "text-green-500" : "text-red-400"}`}>
                {r.direction === "credit" ? "+" : "-"}{r.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[#a0a0a5]">{total} total</span>
        <div className="flex gap-2">
          <button className="ab-btn ab-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page}</span>
          <button className="ab-btn ab-btn-ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
