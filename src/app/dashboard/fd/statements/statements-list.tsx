"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Download, FileText } from "lucide-react";
import { formatDate } from "@/lib/format";

type Item = {
  id: string;
  bankName: string;
  fileName: string;
  fromDate: string | null;
  toDate: string | null;
  txnCount: number;
  matchedCount: number;
  uploadedAt: string;
  parseMethod: string;
};

export function StatementsList({ items }: { items: Item[] }) {
  const router = useRouter();
  async function del(id: string) {
    if (!confirm("Delete this statement and all its transactions?")) return;
    const r = await fetch(`/api/fd/statements/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
  }
  if (items.length === 0) {
    return <p className="text-[14px] text-[#a0a0a5]">No statements uploaded yet.</p>;
  }
  return (
    <div className="ab-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-[#ededed]">
          <thead className="text-[#a0a0a5] text-left bg-[#1c1c20]">
            <tr>
              <th className="px-3 py-2 font-medium">Bank</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Uploaded</th>
              <th className="px-3 py-2 font-medium text-right">Txns</th>
              <th className="px-3 py-2 font-medium text-right">Matched</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-[#2a2a2e]">
                <td className="px-3 py-2">{s.bankName}</td>
                <td className="px-3 py-2">{s.fromDate ? `${formatDate(s.fromDate)} – ${formatDate(s.toDate!)}` : "—"}</td>
                <td className="px-3 py-2">{formatDate(s.uploadedAt)}</td>
                <td className="px-3 py-2 text-right">{s.txnCount}</td>
                <td className="px-3 py-2 text-right">{s.matchedCount}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/fd/statements/${s.id}`} className="text-[#ff385c] inline-flex items-center gap-1">
                      <FileText size={13} /> View
                    </Link>
                    <a href={`/api/fd/statements/${s.id}/pdf`} className="text-[#ededed] inline-flex items-center gap-1">
                      <Download size={13} /> PDF
                    </a>
                    <button onClick={() => del(s.id)} className="text-red-400 inline-flex items-center gap-1">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
