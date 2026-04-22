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
  const sourceLabel = rate?.source === "manual" ? "Manual override" : "India (IBJA)";

  return (
    <div className="ab-card px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#f5a524]/15 text-[#f5a524]">
          <Coins size={14} />
        </span>
        <div className="leading-tight">
          <p className="text-[12px] font-semibold text-[#ededed]">Today's Gold Rate</p>
          <p className="text-[10px] text-[#a0a0a5] mt-0.5">
            {rate ? (
              <>
                {sourceLabel} · {rate.date}
                {stale && <span className="ml-1 text-[#f5a524]">(stale)</span>}
              </>
            ) : (
              "No rate available"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <KaratTile label="22K" value={rate?.rate22kPerG} />
        <KaratTile label="24K" value={rate?.rate24kPerG} highlight />
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

function KaratTile({
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
      className="rounded-md px-3 py-2 border flex-1 flex items-baseline gap-2"
      style={{
        borderColor: highlight ? "rgba(245,165,36,0.35)" : "#2a2a2e",
        background: highlight
          ? "linear-gradient(135deg, rgba(245,165,36,0.08), rgba(245,165,36,0.02))"
          : "#141418",
      }}
    >
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#a0a0a5]">
        {label}
      </span>
      <p className="mono text-[16px] font-bold text-[#ededed] leading-tight">
        {value != null ? `₹${Math.round(value).toLocaleString("en-IN")}` : "—"}
      </p>
      <span className="text-[10px] text-[#6c6c73] ml-auto">/g</span>
    </div>
  );
}
