"use client";
import Link from "next/link";
import { formatDate, formatINR } from "@/lib/format";

export interface FdTxnRow {
  id: string;
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: string;
  statementId: string;
}

const TYPE_LABEL: Record<string, string> = {
  interest: "Interest",
  maturity: "Maturity",
  premature_close: "Premature Close",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  tds: "TDS",
  other: "Other",
};

export function FdTxnSection({ rows }: { rows: FdTxnRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="ab-card p-6">
      <h3 className="text-[15px] font-semibold text-[#ededed] mb-4">Interest & Transactions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-[#ededed]">
          <thead className="text-[#a0a0a5]">
            <tr>
              <th className="text-left font-medium pb-2">Date</th>
              <th className="text-left font-medium pb-2">Type</th>
              <th className="text-left font-medium pb-2">Particulars</th>
              <th className="text-right font-medium pb-2">Amount</th>
              <th className="text-left font-medium pb-2">Statement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#2a2a2e]">
                <td className="py-2">{formatDate(r.txnDate)}</td>
                <td className="py-2">
                  <span className="ab-chip">{TYPE_LABEL[r.type] ?? r.type}</span>
                </td>
                <td className="py-2">{r.particulars}</td>
                <td className="py-2 text-right mono">
                  {r.credit > 0 ? `+${formatINR(r.credit)}` : `-${formatINR(r.debit)}`}
                </td>
                <td className="py-2">
                  <Link className="text-[#ff385c]" href={`/dashboard/fd/statements/${r.statementId}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
