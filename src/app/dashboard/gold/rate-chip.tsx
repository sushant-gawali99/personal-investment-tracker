"use client";

import { useState } from "react";
import { RefreshCw, Pencil, Coins } from "lucide-react";
import type { GoldRatePayload } from "@/lib/gold-rate";
import { ManualRateDialog } from "./manual-rate-dialog";

export function RateChip({ initial }: { initial: GoldRatePayload | null }) {
  const [rate, setRate] = useState<GoldRatePayload | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gold/rate/refresh", { method: "POST" });
      if (res.ok) setRate(await res.json());
    } finally {
      setRefreshing(false);
    }
  }

  const stale = !!rate?.staleAsOf;
  const sourceLabel = rate?.source === "manual" ? "Manual" : "IBJA";

  return (
    <div className="ab-card px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 shrink-0">
        <Coins size={14} className="text-[#f5a524]" />
        <span className="text-[12px] font-semibold text-[#ededed]">Gold Rate</span>
        <span className="text-[11px] text-[#6c6c73]">
          {rate ? (
            <>
              {sourceLabel} · {rate.date}
              {stale && <span className="ml-1 text-[#f5a524]">(stale)</span>}
            </>
          ) : (
            "—"
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <KaratPill label="22K" value={rate?.rate22kPerG} />
        <KaratPill label="24K" value={rate?.rate24kPerG} highlight />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={refresh}
          disabled={refreshing}
          className="ab-btn ab-btn-ghost"
          title="Refresh rate"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setManualOpen(true)}
          className="ab-btn ab-btn-ghost"
          title="Set manual rate"
        >
          <Pencil size={13} /> Manual
        </button>
      </div>

      {manualOpen && (
        <ManualRateDialog
          current={rate}
          onClose={() => setManualOpen(false)}
          onSaved={(r) => setRate(r)}
          onCleared={async () => {
            const res = await fetch("/api/gold/rate");
            if (res.ok) setRate(await res.json());
          }}
        />
      )}
    </div>
  );
}

function KaratPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-full pl-2 pr-3 py-1 inline-flex items-center gap-2 border"
      style={{
        borderColor: highlight ? "rgba(245,165,36,0.4)" : "#2a2a2e",
        background: highlight ? "rgba(245,165,36,0.08)" : "#141418",
      }}
    >
      <span
        className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full"
        style={{
          color: highlight ? "#f5a524" : "#a0a0a5",
          background: highlight ? "rgba(245,165,36,0.15)" : "#1c1c20",
        }}
      >
        {label}
      </span>
      <span className="mono text-[14px] font-bold text-[#ededed] leading-none">
        {value != null ? `₹${Math.round(value).toLocaleString("en-IN")}` : "—"}
      </span>
      <span className="text-[10px] text-[#6c6c73] leading-none">/g</span>
    </div>
  );
}
