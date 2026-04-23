// src/components/bank-accounts/chart-tooltip.tsx
"use client";
import { formatINR } from "@/lib/format";

interface Series {
  dataKey: string;
  label: string;
  color: string;
}

interface PayloadEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
}

/**
 * Custom Recharts tooltip. Pass as `<Tooltip content={<ChartTooltip .../>} />`.
 * Recharts injects `active`, `payload`, `label` at runtime — we accept them as
 * optional instead of extending TooltipProps (generics vary by recharts version).
 */
interface Props {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string | number;
  series?: Series[];
  title?: (label: string | number | undefined) => string;
}

export function ChartTooltip({ active, payload, label, series, title }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const displayTitle = title ? title(label) : String(label ?? "");

  const byKey = new Map<string, PayloadEntry>(
    payload.map((p) => [String(p.dataKey ?? ""), p]),
  );

  const rows: Array<Series & { value: number }> = series
    ? series.flatMap((s) => {
        const p = byKey.get(s.dataKey);
        if (!p || p.value == null) return [];
        return [{ ...s, value: Number(p.value) }];
      })
    : payload.map((p) => ({
        dataKey: String(p.dataKey ?? ""),
        label: String(p.name ?? p.dataKey ?? ""),
        color: p.color ?? "#ededed",
        value: Number(p.value ?? 0),
      }));

  return (
    <div
      className="ab-card-flat px-3 py-2.5"
      style={{ minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
    >
      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1.5">
        {displayTitle}
      </p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="text-[12px] text-[#ededed] truncate">{r.label}</span>
            </div>
            <span className="mono text-[13px] font-semibold text-[#ededed]">
              {formatINR(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
