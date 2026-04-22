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
    <div className="ab-card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#f5a524]/15 text-[#f5a524]">
            <Coins size={16} />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[#ededed] leading-tight">Today's Gold Rate</p>
            <p className="text-[11px] text-[#a0a0a5] mt-0.5">
              {rate ? (
                <>
                  {sourceLabel} · as of {rate.date}
                  {stale && <span className="ml-1 text-[#f5a524]">(stale)</span>}
                </>
              ) : (
                "No rate available"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="ab-btn ab-btn-ghost"
            title="Refresh rate"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setManualOpen(true)}
            className="ab-btn ab-btn-ghost"
            title="Set manual rate"
          >
            <Pencil size={14} /> Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KaratTile label="22K" sub="91.6% purity" value={rate?.rate22kPerG} />
        <KaratTile label="24K" sub="99.9% purity" value={rate?.rate24kPerG} highlight />
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
  sub,
  value,
  highlight,
}: {
  label: string;
  sub: string;
  value?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        borderColor: highlight ? "rgba(245,165,36,0.35)" : "#2a2a2e",
        background: highlight
          ? "linear-gradient(135deg, rgba(245,165,36,0.08), rgba(245,165,36,0.02))"
          : "#141418",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[#a0a0a5]">
          {label}
        </span>
        <span className="text-[10px] text-[#6c6c73]">{sub}</span>
      </div>
      <p className="mono text-[26px] font-bold text-[#ededed] leading-tight">
        {value != null ? `₹${Math.round(value).toLocaleString("en-IN")}` : "—"}
      </p>
      <p className="text-[11px] text-[#a0a0a5] mt-0.5">per gram</p>
    </div>
  );
}
