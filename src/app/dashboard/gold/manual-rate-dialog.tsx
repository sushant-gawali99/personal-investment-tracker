"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GoldRatePayload } from "@/lib/gold-rate";

export function ManualRateDialog({
  current,
  onClose,
  onSaved,
  onCleared,
}: {
  current: GoldRatePayload | null;
  onClose: () => void;
  onSaved: (r: GoldRatePayload) => void;
  onCleared: () => void;
}) {
  const [r22, setR22] = useState(current?.rate22kPerG?.toString() ?? "");
  const [r24, setR24] = useState(current?.rate24kPerG?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/gold/rate/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate22kPerG: Number(r22), rate24kPerG: Number(r24) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/gold/rate/manual", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      onCleared();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ab-card w-full max-w-[420px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#ededed]">Set today's gold rate</h2>
          <button onClick={onClose} className="ab-btn ab-btn-ghost"><X size={16} /></button>
        </div>
        <label className="block text-[12px] text-[#a0a0a5]">22K ₹ per gram
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={r22} onChange={(e) => setR22(e.target.value)} />
        </label>
        <label className="block text-[12px] text-[#a0a0a5]">24K ₹ per gram
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={r24} onChange={(e) => setR24(e.target.value)} />
        </label>
        {error && <p className="text-[12px] text-[#ff6b7a]">{error}</p>}
        <div className="flex justify-between gap-2 pt-2">
          <button className="ab-btn ab-btn-ghost" onClick={clear} disabled={busy}>Clear override</button>
          <div className="flex gap-2">
            <button className="ab-btn ab-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ab-btn ab-btn-accent" onClick={save} disabled={busy || !(Number(r22) > 0) || !(Number(r24) > 0)}>Save override</button>
          </div>
        </div>
      </div>
    </div>
  );
}
