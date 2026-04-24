import { Wallet } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";

export interface BankBalance {
  id: string;
  label: string;
  bankName: string;
  closingBalance: number | null;
  asOf: string | null;
}

function bankAccent(bankName: string): { bg: string; fg: string; line: string } {
  const key = (bankName ?? "").toLowerCase();
  if (key.includes("hdfc"))                            return { bg: "rgba(0,79,159,0.14)",   fg: "#5aa9ff", line: "#5aa9ff" };
  if (key.includes("axis"))                            return { bg: "rgba(174,35,61,0.14)",  fg: "#ff7a8a", line: "#ff7a8a" };
  if (key.includes("icici"))                           return { bg: "rgba(175,27,45,0.14)",  fg: "#ff8074", line: "#ff8074" };
  if (key.includes("sbi") || key.includes("state bank")) return { bg: "rgba(30,77,163,0.14)", fg: "#7ab8ff", line: "#7ab8ff" };
  if (key.includes("kotak"))                           return { bg: "rgba(208,29,47,0.14)",  fg: "#ff8090", line: "#ff8090" };
  if (key.includes("idfc"))                            return { bg: "rgba(234,60,83,0.14)",  fg: "#ff7a90", line: "#ff7a90" };
  if (key.includes("tbsb") || key.includes("thane") || key.includes("bharat")) return { bg: "rgba(94,224,164,0.10)", fg: "#5ee0a4", line: "#5ee0a4" };
  return { bg: "rgba(255,56,92,0.12)", fg: "#ff385c", line: "#ff385c" };
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
            className="rounded-2xl overflow-hidden border border-[#252528] hover:border-[#3a3a3e] transition-colors"
            style={{ background: "linear-gradient(160deg, #1e1e22 0%, #17171a 100%)" }}
          >
            {/* Accent top line */}
            <div className="h-[2px]" style={{ background: accent.line, opacity: 0.55 }} />
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest shrink-0"
                  style={{ background: accent.bg, color: accent.fg }}
                >
                  {b.bankName}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] text-[#a0a0a5] font-medium leading-tight truncate" title={b.label}>{b.label}</p>
                {hasBalance ? (
                  <>
                    <p className={`mono text-[22px] font-bold leading-none mt-2 tracking-tight ${b.closingBalance! >= 0 ? "text-[#ededed]" : "text-[#ff7a6e]"}`}>
                      {formatINR(b.closingBalance!)}
                    </p>
                    {b.asOf && (
                      <p className="text-[10px] text-[#4a4a4e] mt-2 uppercase tracking-wider">
                        {formatDate(b.asOf)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mono text-[22px] font-bold leading-none mt-2 text-[#2e2e32]">—</p>
                    <p className="text-[10px] text-[#3a3a3e] mt-2 uppercase tracking-wider">No statement</p>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Net total tile */}
      {knownBalances.length > 1 && (
        <div
          className="rounded-2xl overflow-hidden border border-[#252528]"
          style={{ background: "linear-gradient(160deg, #1a1e1a 0%, #17171a 100%)" }}
        >
          <div className="h-[2px]" style={{ background: "#5ee0a4", opacity: 0.45 }} />
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-[rgba(94,224,164,0.10)] text-[#5ee0a4]">
                Net Total
              </span>
            </div>
            <div>
              <p className="text-[12px] text-[#a0a0a5] font-medium leading-tight">
                {allKnown ? "All accounts" : `${knownBalances.length} of ${balances.length} accounts`}
              </p>
              <p className={`mono text-[22px] font-bold leading-none mt-2 tracking-tight ${netTotal >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
                {netTotal >= 0 ? "+" : ""}{formatINR(netTotal)}
              </p>
              {!allKnown && (
                <p className="text-[10px] text-[#4a4a4e] mt-2 uppercase tracking-wider">Partial</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
