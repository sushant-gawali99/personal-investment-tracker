// src/app/dashboard/bank-accounts/categories/categories-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat {
  id: string; userId: string | null; name: string; kind: string;
  icon: string | null; color: string | null; sortOrder: number;
}
interface Rule {
  id: string; pattern: string; matchCount: number;
  category: Cat;
}

export function CategoriesClient({ categories, rules }: { categories: Cat[]; rules: Rule[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", kind: "expense" as "expense" | "income" | "transfer" });
  const [error, setError] = useState<string | null>(null);

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/bank-accounts/categories", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ name: "", kind: "expense" });
    router.refresh();
  }
  async function delCat(id: string) {
    if (!confirm("Soft-delete this category? Past transactions keep their label.")) return;
    await fetch(`/api/bank-accounts/categories/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function delRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/bank-accounts/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const userCats = categories.filter((c) => c.userId !== null);
  const presetCats = categories.filter((c) => c.userId === null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <form onSubmit={addCat} className="ab-card p-3 flex gap-2">
          <input className="ab-input flex-1" placeholder="New category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="ab-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "expense" | "income" | "transfer" })}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
          <button className="ab-btn ab-btn-accent">Add</button>
        </form>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="ab-card p-3">
          <h3 className="font-medium mb-2">Presets</h3>
          <ul className="text-sm space-y-1">
            {presetCats.map((c) => <li key={c.id}><span className="text-[#a0a0a5]">{c.kind}:</span> {c.name}</li>)}
          </ul>
        </div>
        <div className="ab-card p-3">
          <h3 className="font-medium mb-2">Your categories</h3>
          {userCats.length === 0
            ? <p className="text-sm text-[#a0a0a5]">No custom categories yet.</p>
            : <ul className="text-sm space-y-1">
                {userCats.map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <span><span className="text-[#a0a0a5]">{c.kind}:</span> {c.name}</span>
                    <button onClick={() => delCat(c.id)} className="text-red-500 underline">Delete</button>
                  </li>
                ))}
              </ul>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Merchant rules</h2>
        {rules.length === 0
          ? <p className="text-sm text-[#a0a0a5]">No rules yet. They appear automatically when you correct a transaction's category.</p>
          : <table className="w-full text-sm ab-card">
              <thead><tr className="text-left text-[#a0a0a5]">
                <th className="p-3">Pattern</th><th className="p-3">Category</th><th className="p-3 text-right">Matches</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-[#2a2a2e]">
                    <td className="p-3 font-mono">{r.pattern}</td>
                    <td className="p-3">{r.category.name}</td>
                    <td className="p-3 text-right">{r.matchCount}</td>
                    <td className="p-3 text-right"><button onClick={() => delRule(r.id)} className="text-red-500 underline">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>
    </div>
  );
}
