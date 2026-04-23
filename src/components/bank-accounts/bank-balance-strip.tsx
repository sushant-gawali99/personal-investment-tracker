import { Landmark } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

export interface BankBalance {
  id: string;
  label: string;
  bankName: string;
  closingBalance: number | null;
  asOf: string | null;
}

/**
 * Horizontal strip of bank-balance tiles: one tile per account, showing the
 * latest known closing balance sourced from the most recent saved
 * StatementImport that captured it. Accounts without a known closing render
 * a muted placeholder so the user knows they need a fresh import.
 */
export function BankBalanceStrip({ balances }: { balances: BankBalance[] }) {
  if (balances.length === 0) return null;
  const anyKnown = balances.some((b) => b.closingBalance != null);
  return (
    <div className="ab-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Bank Balances</h3>
        {!anyKnown && (
          <span className="text-[11px] text-[#6e6e73]">Re-import statements to populate</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {balances.map((b) => (
          <div
            key={b.id}
            className="rounded-xl bg-[#1c1c20] border border-[#2a2a2e] px-3 py-3 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full bg-[#2a1218] flex items-center justify-center shrink-0">
                <Landmark size={13} className="text-[#ff385c]" />
              </span>
              <p className="text-[12px] font-semibold text-[#ededed] truncate" title={b.label}>
                {b.label}
              </p>
            </div>
            {b.closingBalance != null ? (
              <>
                <p className={`mono text-[15px] font-bold ${b.closingBalance >= 0 ? "text-[#ededed]" : "text-[#ff7a6e]"}`}>
                  {formatINR(b.closingBalance)}
                </p>
                {b.asOf && (
                  <p className="text-[10px] text-[#6e6e73]">as of {formatDate(b.asOf)}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#6e6e73]">No balance captured</p>
                <p className="text-[10px] text-[#6e6e73]">Import a statement</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
