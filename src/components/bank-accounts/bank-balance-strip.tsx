import { formatDate, formatINR } from "@/lib/format";

export interface BankBalance {
  id: string;
  label: string;
  bankName: string;
  closingBalance: number | null;
  asOf: string | null;
}

function bankAccent(bankName: string): { fg: string; color: string } {
  const key = (bankName ?? "").toLowerCase();
  if (key.includes("hdfc"))   return { fg: "#5aa9ff", color: "#5aa9ff" };
  if (key.includes("axis"))   return { fg: "#ff7a8a", color: "#ff7a8a" };
  if (key.includes("icici"))  return { fg: "#ff8074", color: "#ff8074" };
  if (key.includes("sbi") || key.includes("state bank")) return { fg: "#7ab8ff", color: "#7ab8ff" };
  if (key.includes("kotak"))  return { fg: "#ff8090", color: "#ff8090" };
  if (key.includes("idfc"))   return { fg: "#ff7a90", color: "#ff7a90" };
  if (key.includes("tbsb") || key.includes("thane") || key.includes("bharat") || key.includes("lokmanya"))
    return { fg: "#5ee0a4", color: "#5ee0a4" };
  return { fg: "#ff385c", color: "#ff385c" };
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
            className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015]"
            style={{
              background: "#0f0f11",
              border: `1px solid ${accent.color}35`,
              boxShadow: `0 0 20px ${accent.color}0a`,
            }}
          >
            {/* Header zone — colored wash */}
            <div
              className="px-4 pt-4 pb-3"
              style={{
                background: `linear-gradient(135deg, ${accent.color}20 0%, ${accent.color}08 100%)`,
                borderBottom: `1px solid ${accent.color}18`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: accent.color }} />
                <p className="text-[12px] font-black uppercase tracking-[0.14em] leading-none" style={{ color: accent.fg }}>
                  {b.bankName}
                </p>
              </div>
            </div>

            {/* Balance zone */}
            <div className="px-4 py-4">
              {hasBalance ? (
                <>
                  <p className={`mono text-[24px] font-bold leading-none tracking-tight ${b.closingBalance! >= 0 ? "text-[#f0f0f2]" : "text-[#ff7a6e]"}`}>
                    {formatINR(b.closingBalance!)}
                  </p>
                  {b.asOf && (
                    <p className="text-[11px] mt-2.5 uppercase tracking-[0.1em] font-bold" style={{ color: `${accent.color}60` }}>
                      {formatDate(b.asOf)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mono text-[24px] font-bold leading-none text-[#222226]">₹ —,—,—</p>
                  <p className="text-[11px] mt-2.5 font-semibold" style={{ color: `${accent.color}70` }}>
                    Import statement →
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Net total */}
      {knownBalances.length > 1 && (
        <div
          className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015]"
          style={{
            background: "#0f0f11",
            border: "1px solid rgba(94,224,164,0.3)",
            boxShadow: "0 0 20px rgba(94,224,164,0.05)",
          }}
        >
          <div
            className="px-4 pt-4 pb-3"
            style={{
              background: "linear-gradient(135deg, rgba(94,224,164,0.16) 0%, rgba(94,224,164,0.06) 100%)",
              borderBottom: "1px solid rgba(94,224,164,0.14)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-[6px] h-[6px] rounded-full bg-[#5ee0a4] shrink-0" />
              <p className="text-[12px] font-black uppercase tracking-[0.14em] leading-none text-[#5ee0a4]">
                Net Total
              </p>
            </div>
            <p className="text-[12px] text-[#505055] font-medium">
              {allKnown ? "All accounts" : `${knownBalances.length} / ${balances.length}`}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className={`mono text-[24px] font-bold leading-none tracking-tight ${netTotal >= 0 ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
              {netTotal >= 0 ? "+" : ""}{formatINR(netTotal)}
            </p>
            {!allKnown && (
              <p className="text-[9px] mt-2.5 uppercase tracking-[0.14em] font-bold text-[rgba(94,224,164,0.4)]">
                Partial
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
