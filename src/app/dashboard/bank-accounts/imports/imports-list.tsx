// src/app/dashboard/bank-accounts/imports/imports-list.tsx
"use client";
import { useRouter } from "next/navigation";

interface Item {
  id: string; fileName: string; status: string;
  account: { id: string; label: string };
  statementPeriodStart: string | null; statementPeriodEnd: string | null;
  extractedCount: number; newCount: number; duplicateCount: number;
  claudeCostUsd: number | null;
  createdAt: string;
  errorMessage: string | null;
}

export function ImportsList({ items }: { items: Item[] }) {
  const router = useRouter();
  async function remove(id: string) {
    if (!confirm("Delete this import and all its saved transactions?")) return;
    await fetch(`/api/bank-accounts/import/${id}`, { method: "DELETE" });
    router.refresh();
  }
  if (items.length === 0) return <p className="text-sm text-[#a0a0a5]">No imports yet.</p>;
  return (
    <table className="w-full text-sm ab-card">
      <thead><tr className="text-left text-[#a0a0a5]">
        <th className="p-3">File</th><th className="p-3">Account</th><th className="p-3">Period</th>
        <th className="p-3">Status</th><th className="p-3 text-right">Txns</th>
        <th className="p-3 text-right">Cost</th><th className="p-3"></th>
      </tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-t border-[#2a2a2e]">
            <td className="p-3">{i.fileName}</td>
            <td className="p-3">{i.account.label}</td>
            <td className="p-3 text-[#a0a0a5]">
              {i.statementPeriodStart ? `${i.statementPeriodStart.slice(0, 10)} → ${i.statementPeriodEnd?.slice(0, 10) ?? "?"}` : "—"}
            </td>
            <td className="p-3">{i.status}{i.errorMessage ? ` — ${i.errorMessage}` : ""}</td>
            <td className="p-3 text-right">{i.newCount}/{i.extractedCount}</td>
            <td className="p-3 text-right">{i.claudeCostUsd ? `$${i.claudeCostUsd.toFixed(4)}` : "—"}</td>
            <td className="p-3 text-right"><button onClick={() => remove(i.id)} className="text-red-500 underline">Delete</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
