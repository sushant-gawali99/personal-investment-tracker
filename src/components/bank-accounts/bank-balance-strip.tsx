import { Landmark, Wallet } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

export interface BankBalance {
  id: string;
  label: string;
  bankName: string;
  closingBalance: number | null;
  asOf: string | null;
}

function bankAccent(bankName: string): { bg: string; fg: string } {
  const key = (bankName ?? "").toLowerCase();
  if (key.includes("hdfc"))                       return { bg: "rgba(0,79,159,0.18)",   fg: "#5aa9ff" };
  if (key.includes("axis"))                       return { bg: "rgba(174,35,61,0.18)",  fg: "#ff7a8a" };
  if (key.includes("icici"))                      return { bg: "rgba(175,27,45,0.18)",  fg: "#ff8074" };
  if (key.includes("sbi") || key.includes("state bank")) return { bg: "rgba(30,77,163,0.18)", fg: "#7ab8ff" };
  if (key.includes("kotak"))                      return { bg: "rgba(208,29,47,0.18)",  fg: "#ff8090" };
  if (key.includes("idfc"))                       return { bg: "rgba(234,60,83,0.18)",  fg: "#ff7a90" };
  return { bg: "rgba(255,56,92,0.14)", fg: "#ff385c" };
}

export function BankBalanceStrip({ balances }: { balances: BankBalance[] }) {
  if (balances.length === 0) return null;

  const knownBalances = balances.filter((b) => b.closingBalance != null);
  const netTotal = knownBalances.reduce((sum, b) => sum + b.closingBalance!, 0);
  const allKnown = knownBalances.length === balances.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {balances.map((b) => {
        const accent = bankAccent(b.bankName);
        const hasBalance = b.closingBalance != null;
        return (
          <div
            key={b.id}
            className="rounded-2xl bg-[#1c1c20] border border-[#2a2a2e] p-4 flex flex-col gap-3 hover:border-[#3a3a3e] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: accent.bg, color: accent.fg }}
              >
                <Landmark size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#ededed] truncate leading-tight" title={b.label}>{b.label}</p>
                <p className="text-[10px] text-[#6e6e73] truncate mt-0.5">{b.bankName}</p>
              </div>
            </div>
            {hasBalance ? (
              <div>
                <p className={`mono text-[17px] font-bold leading-none ${b.closingBalance! >= 0 ? "text-[#ededed]" : "text-[#ff7a6e]"}`}>
                  {formatINR(b.closingBalance!)}
                </p>
                {b.asOf && (
                  <p className="text-[10px] text-[#6e6e73] mt-1.5">as of {formatDate(b.asOf)}</p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-[#4a4a4e] font-medium">—</p>
                <p className="text-[10px] text-[#4a4a4e] mt-1.5">No statement imported</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Net total tile */}
      {knownBalances.length > 1 && (
        <div className="rounded-2xl bg-[#17171a] border border-[#2a2a2e] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[rgba(255,56,92,0.12)] flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-[#ff385c]" />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-[#a0a0a5] leading-tight">Net Total</p>
              <p className="text-[10px] text-[#6e6e73] mt-0.5">
                {allKnown ? "all accounts" : `${knownBalances.length} of ${balances.length} accounts`}
              </p>
            </div>
          </div>
          <div>
            <p className={`mono text-[17px] font-bold leading-none ${netTotal >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
              {netTotal >= 0 ? "+" : ""}{formatINR(netTotal)}
            </p>
            {!allKnown && (
              <p className="text-[10px] text-[#6e6e73] mt-1.5">partial — import missing statements</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
