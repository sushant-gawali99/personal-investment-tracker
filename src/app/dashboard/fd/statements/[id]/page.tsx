import { notFound } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { formatDate, formatINR } from "@/lib/format";

export default async function StatementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const s = await prisma.fDStatement.findFirst({
    where: { id, userId: userId ?? "" },
    include: { transactions: { orderBy: { txnDate: "desc" }, include: { fd: true } } },
  });
  if (!s) notFound();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold text-[#ededed]">{s.bankName}</h1>
          <p className="text-[13px] text-[#a0a0a5] mt-1">{s.fileName}</p>
        </div>
        <a href={`/api/fd/statements/${s.id}/pdf`} className="ab-btn ab-btn-ghost inline-flex items-center gap-1">
          <Download size={14} /> Download PDF
        </a>
      </div>
      <p className="text-[13px] text-[#a0a0a5]">
        Period {s.fromDate ? formatDate(s.fromDate) : "—"} → {s.toDate ? formatDate(s.toDate) : "—"} · {s.txnCount} txns · {s.matchedCount} matched · parsed by <em>{s.parseMethod}</em>
      </p>
      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-[#ededed]">
            <thead className="text-[#a0a0a5] bg-[#1c1c20]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Particulars</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">FD</th>
              </tr>
            </thead>
            <tbody>
              {s.transactions.map((t) => (
                <tr key={t.id} className="border-t border-[#2a2a2e]">
                  <td className="px-3 py-2">{formatDate(t.txnDate)}</td>
                  <td className="px-3 py-2">{t.type}</td>
                  <td className="px-3 py-2">{t.particulars}</td>
                  <td className="px-3 py-2 text-right">{t.credit > 0 ? `+${formatINR(t.credit)}` : `-${formatINR(t.debit)}`}</td>
                  <td className="px-3 py-2">
                    {t.fd ? <Link className="text-[#ff385c]" href={`/dashboard/fd/${t.fd.id}`}>{t.fd.fdNumber ?? t.fd.accountNumber}</Link> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
