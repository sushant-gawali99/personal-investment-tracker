"use client";

import { useState } from "react";
import { RefreshCw, Pencil } from "lucide-react";
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className={
          "ab-chip " +
          (stale ? "ab-chip-warning" : "ab-chip-muted")
        }
        title={rate ? `source: ${rate.source}${stale ? " (stale)" : ""}` : "No rate available"}
      >
        {rate
          ? <>India (IBJA) · 22K ₹{Math.round(rate.rate22kPerG).toLocaleString("en-IN")}/g · 24K ₹{Math.round(rate.rate24kPerG).toLocaleString("en-IN")}/g · as of {rate.date}</>
          : <>No rate yet</>
        }
      </div>
      <button onClick={refresh} disabled={refreshing} className="ab-btn ab-btn-ghost" title="Refresh rate">
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
      </button>
      <button onClick={() => setManualOpen(true)} className="ab-btn ab-btn-ghost" title="Set manual rate">
        <Pencil size={14} /> Manual
      </button>
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
