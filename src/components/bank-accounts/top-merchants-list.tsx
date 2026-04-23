// src/components/bank-accounts/top-merchants-list.tsx
import { Store } from "lucide-react";
import { formatINR } from "@/lib/format";
import { prettifyDescription } from "@/lib/bank-accounts/pretty-description";

interface Merchant {
  normalizedDescription: string;
  total: number;
  count: number;
}

/**
 * The analytics API groups by `normalizedDescription` — a dedup string that
 * retains slashes and formatting. Running the prettifier over it extracts a
 * human-readable merchant name; the rest of the string becomes a tooltip.
 */
function merchantDisplay(raw: string): string {
  const pretty = prettifyDescription(raw);
  return pretty.merchant || raw;
}

/** First 2 alphanumeric characters, uppercased — for merchant avatars. */
function initials(s: string): string {
  const cleaned = s.replace(/[^A-Za-z0-9]/g, "").slice(0, 2);
  return cleaned.toUpperCase() || "?";
}

/** Stable pastel-on-dark color picked from the string hash. */
function avatarBg(s: string): string {
  const palette = [
    "rgba(255,56,92,0.14)",
    "rgba(90,169,255,0.14)",
    "rgba(94,224,164,0.14)",
    "rgba(245,165,36,0.14)",
    "rgba(167,139,250,0.14)",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function avatarFg(s: string): string {
  const palette = ["#ff8aa0", "#5aa9ff", "#5ee0a4", "#f5a524", "#a78bfa"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function TopMerchantsList({
  items,
  maxHeight,
}: {
  items: Merchant[];
  /** Optional explicit card height — used by the overview to match the
   *  DailyHeatmap card so they align as a pair. When set, the internal
   *  list scrolls instead of pushing the row taller. */
  maxHeight?: number;
}) {
  return (
    // flex-col keeps the header pinned while the list scrolls internally
    // via the `overflow-y-auto` wrapper below. When a maxHeight is passed
    // we use height (not max-height) so the card always matches its sibling.
    <div
      className="ab-card p-6 flex flex-col min-h-0"
      style={maxHeight ? { height: maxHeight } : undefined}
    >
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Top Merchants</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-0.5">
            {items.length > 0
              ? `${items.length} merchant${items.length === 1 ? "" : "s"} this period`
              : "Ranked by total spend this period"}
          </p>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(245,165,36,0.12)]">
          <Store size={15} className="text-[#f5a524]" />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-[#6e6e73] py-6 text-center">No merchants this period.</p>
      ) : (
        // Scrollable list region. `min-h-0` is the flex-item magic that
        // allows overflow to actually kick in (otherwise the child ul
        // would force the card to grow past its grid cell).
        <div className="flex-1 min-h-0 -mr-3 pr-3 overflow-y-auto ab-scroll">
          <ul className="divide-y divide-[#2a2a2e]">
            {items.map((m, i) => {
              const name = merchantDisplay(m.normalizedDescription);
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 group"
                  title={m.normalizedDescription}
                >
                  <span className="mono text-[11px] font-semibold text-[#6e6e73] w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{ background: avatarBg(name), color: avatarFg(name) }}
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#ededed] truncate">
                      {name}
                    </p>
                    <p className="text-[11px] text-[#a0a0a5] mt-0.5">
                      {m.count} transaction{m.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="mono text-[14px] font-semibold text-[#ededed] shrink-0">
                    {formatINR(m.total)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
