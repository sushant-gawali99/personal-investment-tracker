"use client";

import { useState, useEffect } from "react";
import { X, Upload } from "lucide-react";
import type { GoldItem } from "@prisma/client";

type Input = {
  title: string;
  weightGrams: string;
  karat: "24" | "22" | "18" | "14";
  purchasePrice: string;
  purchasedOn: string;
  purchasedFrom: string;
  notes: string;
  photoUrl: string | null;
};

function toInput(item?: GoldItem | null): Input {
  return {
    title: item?.title ?? "",
    weightGrams: item?.weightGrams?.toString() ?? "",
    karat: (item?.karat?.toString() as Input["karat"]) ?? "22",
    purchasePrice: item?.purchasePrice?.toString() ?? "",
    purchasedOn: item?.purchasedOn ? new Date(item.purchasedOn).toISOString().slice(0, 10) : "",
    purchasedFrom: item?.purchasedFrom ?? "",
    notes: item?.notes ?? "",
    photoUrl: item?.photoUrl ?? null,
  };
}

export function GoldFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: GoldItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<Input>(() => toInput(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setInput(toInput(initial)), [initial]);

  function update<K extends keyof Input>(key: K, value: Input[K]) {
    setInput((s) => ({ ...s, [key]: value }));
  }

  async function handlePhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gold/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      update("photoUrl", data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: input.title.trim(),
        weightGrams: Number(input.weightGrams),
        karat: Number(input.karat),
        photoUrl: input.photoUrl,
        purchasePrice: input.purchasePrice === "" ? null : Number(input.purchasePrice),
        purchasedOn: input.purchasedOn || null,
        purchasedFrom: input.purchasedFrom.trim() || null,
        notes: input.notes.trim() || null,
      };
      const res = initial
        ? await fetch(`/api/gold/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`/api/gold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ab-card w-full max-w-[520px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#ededed]">{initial ? "Edit jewellery" : "Add jewellery"}</h2>
          <button onClick={onClose} className="ab-btn ab-btn-ghost"><X size={16} /></button>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Title *
          <input className="ab-input mt-1 w-full" value={input.title} onChange={(e) => update("title", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-[#a0a0a5]">Weight (g) *
            <input type="number" step="0.001" min="0" className="ab-input mt-1 w-full" value={input.weightGrams} onChange={(e) => update("weightGrams", e.target.value)} />
          </label>
          <label className="block text-[12px] text-[#a0a0a5]">Karat *
            <select className="ab-input mt-1 w-full" value={input.karat} onChange={(e) => update("karat", e.target.value as Input["karat"])}>
              <option value="24">24K</option>
              <option value="22">22K</option>
              <option value="18">18K</option>
              <option value="14">14K</option>
            </select>
          </label>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Purchase price (₹)
          <input type="number" step="0.01" min="0" className="ab-input mt-1 w-full" value={input.purchasePrice} onChange={(e) => update("purchasePrice", e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-[#a0a0a5]">Purchased on
            <input type="date" className="ab-input mt-1 w-full" value={input.purchasedOn} onChange={(e) => update("purchasedOn", e.target.value)} />
          </label>
          <label className="block text-[12px] text-[#a0a0a5]">Purchased from
            <input className="ab-input mt-1 w-full" value={input.purchasedFrom} onChange={(e) => update("purchasedFrom", e.target.value)} />
          </label>
        </div>

        <label className="block text-[12px] text-[#a0a0a5]">Notes
          <textarea rows={3} className="ab-input mt-1 w-full" value={input.notes} onChange={(e) => update("notes", e.target.value)} />
        </label>

        <div className="space-y-2">
          <div className="text-[12px] text-[#a0a0a5]">Photo</div>
          {input.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={input.photoUrl} alt="" className="h-24 rounded object-cover" />
          )}
          <label className="ab-btn ab-btn-ghost inline-flex cursor-pointer">
            <Upload size={14} /> {input.photoUrl ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          </label>
          {input.photoUrl && (
            <button type="button" className="ab-btn ab-btn-ghost ml-2" onClick={() => update("photoUrl", null)}>Remove photo</button>
          )}
          {uploading && <p className="text-[12px] text-[#a0a0a5]">Uploading…</p>}
        </div>

        {error && <p className="text-[12px] text-[#ff6b7a]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button className="ab-btn ab-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="ab-btn ab-btn-accent" onClick={save} disabled={saving || !input.title || !input.weightGrams}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
