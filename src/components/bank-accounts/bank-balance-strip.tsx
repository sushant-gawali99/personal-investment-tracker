"use client";

import Link from "next/link";
import { formatDate, formatINR } from "@/lib/format";
import { useTheme } from "@/components/theme-provider";

export interface BankBalance {
  id: string;
  label: string;
  bankName: string;
  closingBalance: number | null;
  asOf: string | null;
}

function bankAccent(bankName: string): { fg: string; color: string } {
  const key = (bankName ?? "").toLowerCase();
  if (key.includes("hdfc"))   return { fg: "var(--accent-info)", color: "var(--accent-info)" };
  if (key.includes("axis"))   return { fg: "var(--accent-error)", color: "var(--accent-error)" };
  if (key.includes("icici"))  return { fg: "#ff8074", color: "#ff8074" };
  if (key.includes("sbi") || key.includes("state bank")) return { fg: "#7ab8ff", color: "#7ab8ff" };
  if (key.includes("kotak"))  return { fg: "#ff8090", color: "#ff8090" };
  if (key.includes("idfc"))   return { fg: "#ff7a90", color: "#ff7a90" };
  if (key.includes("tbsb") || key.includes("thane") || key.includes("bharat") || key.includes("lokmanya"))
    return { fg: "var(--accent-success)", color: "var(--accent-success)" };
  return { fg: "var(--primary)", color: "var(--primary)" };
}

export function BankBalanceStrip({ balances }: { balances: BankBalance[] }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (balances.length === 0) return null;

  const knownBalances = balances.filter((b) => b.closingBalance != null);

  // Light mode needs higher opacity since accent colors are darker (on white bg)
  const borderOp   = isLight ? 50 : 22;
  const gradFrom   = isLight ? 30 : 13;
  const gradTo     = isLight ? 10 : 3;
  const shadowOp   = isLight ? 10 : 4;
  const importOp   = isLight ? 75 : 44;
  const dateOp     = isLight ? 65 : 38;
  const netTotal = knownBalances.reduce((sum, b) => sum + b.closingBalance!, 0);
  const allKnown = knownBalances.length === balances.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {balances.map((b) => {
        const accent = bankAccent(b.bankName);
        const hasBalance = b.closingBalance != null;
        // Click → transactions filtered by this account when balance is known.
        // No balance → take the user to the Statements/import flow instead.
        const href = hasBalance
          ? `/dashboard/bank-accounts/list?accountId=${b.id}`
          : `/dashboard/bank-accounts/imports`;
        return (
          <Link
            key={b.id}
            href={href}
            aria-label={hasBalance ? `View transactions for ${b.bankName}` : `Import statement for ${b.bankName}`}
            className="block rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015] hover:-translate-y-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            style={{
              background: "var(--surface-raised)",
              border: `1px solid color-mix(in srgb, ${accent.color} ${borderOp}%, transparent)`,
              boxShadow: `0 0 20px color-mix(in srgb, ${accent.color} ${shadowOp}%, transparent)`,
            }}
          >
            {/* Header zone — colored wash */}
            <div
              className="px-4 pt-4 pb-3"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${accent.color} ${gradFrom}%, transparent) 0%, color-mix(in srgb, ${accent.color} ${gradTo}%, transparent) 100%)`,
                borderBottom: `1px solid color-mix(in srgb, ${accent.color} ${Math.round(borderOp * 0.4)}%, transparent)`,
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
                  <p className={`mono text-[24px] font-bold leading-none tracking-tight ${b.closingBalance! >= 0 ? "text-[var(--text-primary)]" : "text-[var(--accent-error)]"}`}>
                    {formatINR(b.closingBalance!)}
                  </p>
                  {b.asOf && (
                    <p className="text-[11px] mt-2.5 uppercase tracking-[0.1em] font-bold" style={{ color: `color-mix(in srgb, ${accent.color} ${dateOp}%, transparent)` }}>
                      {formatDate(b.asOf)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mono text-[24px] font-bold leading-none text-[var(--surface-subtle)]">₹ —,—,—</p>
                  <p className="text-[11px] mt-2.5 font-semibold" style={{ color: `color-mix(in srgb, ${accent.color} ${importOp}%, transparent)` }}>
                    Import statement →
                  </p>
                </>
              )}
            </div>
          </Link>
        );
      })}

      {/* Net total */}
      {knownBalances.length > 1 && (
        <div
          className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015]"
          style={{
            background: "var(--background)",
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
              <div className="w-[6px] h-[6px] rounded-full bg-[var(--accent-success)] shrink-0" />
              <p className="text-[12px] font-black uppercase tracking-[0.14em] leading-none text-[var(--accent-success)]">
                Net Total
              </p>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] font-medium">
              {allKnown ? "All accounts" : `${knownBalances.length} / ${balances.length}`}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className={`mono text-[24px] font-bold leading-none tracking-tight ${netTotal >= 0 ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}`}>
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
