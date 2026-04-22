"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Image, X } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { GoldItem } from "@prisma/client";
import type { GoldRatePayload } from "@/lib/gold-rate";
import { GoldFormDialog } from "./gold-form-dialog";

export type GoldRow = GoldItem & { currentValue: number | null; gainLoss: number | null };

function purchaseLabel(item: GoldItem): string {
  const date = item.purchasedOn
    ? new Date(item.purchasedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  if (item.purchasedFrom && date) return `${item.purchasedFrom} (${date})`;
  if (item.purchasedFrom) return item.purchasedFrom;
  if (date) return date;
  return "—";
}

function PhotoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-[#1f1f23] rounded-full p-1.5 text-[#a0a0a5] hover:text-[#ededed] transition-colors"
        >
          <X size={16} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-full rounded-lg object-contain max-h-[80vh]" />
      </div>
    </div>
  );
}

export function GoldList({
  initialItems,
  initialRate,
}: {
  initialItems: GoldRow[];
  initialRate: GoldRatePayload | null;
}) {
  const [items, setItems] = useState<GoldRow[]>(initialItems);
  const [editing, setEditing] = useState<GoldItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const summary = useMemo(() => {
    const active = items.filter((i) => !i.disabled);
    const totalWeight = active.reduce((s, i) => s + i.weightGrams, 0);
    const withPrice = active.filter((i) => i.purchasePrice != null);
    const invested = withPrice.reduce((s, i) => s + (i.purchasePrice ?? 0), 0);
    const currentValue = active.reduce((s, i) => s + (i.currentValue ?? 0), 0);
    const gainLossItems = withPrice.reduce((s, i) => s + (i.gainLoss ?? 0), 0);
    const gainLossPct = invested > 0 ? (gainLossItems / invested) * 100 : 0;
    return { count: active.length, totalWeight, invested, currentValue, gainLoss: gainLossItems, gainLossPct };
  }, [items]);

  async function reload() {
    const res = await fetch("/api/gold");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this jewellery item?")) return;
    const res = await fetch(`/api/gold/${id}`, { method: "DELETE" });
    if (res.ok) setItems((xs) => xs.filter((x) => x.id !== id));
  }

  const gainColor = (v: number | null) =>
    v == null ? "" : v >= 0 ? "text-[#5ee0a4]" : "text-[#ff6b7a]";

  return (
    <>
      {photoUrl && <PhotoModal url={photoUrl} onClose={() => setPhotoUrl(null)} />}

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Items", value: String(summary.count) },
            { label: "Total Weight", value: `${summary.totalWeight.toFixed(2)} g` },
            { label: "Invested", value: summary.invested > 0 ? formatINR(summary.invested) : "—" },
            { label: "Current Value", value: initialRate ? formatINR(summary.currentValue) : "—" },
            {
              label: "Gain / Loss",
              value: summary.invested > 0 && initialRate
                ? `${formatINR(summary.gainLoss)} (${summary.gainLossPct.toFixed(1)}%)`
                : "—",
              color: summary.invested > 0 && initialRate ? gainColor(summary.gainLoss) : "",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="ab-card p-4">
              <p className="text-[10px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className={`mono text-[15px] sm:text-[17px] font-semibold text-[#ededed] ${color ?? ""}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="ab-btn ab-btn-accent"
        >
          <Plus size={15} /> Add jewellery
        </button>
      </div>

      {items.length === 0 ? (
        <div className="ab-card p-10 text-center text-[#a0a0a5]">No jewellery yet. Click "Add jewellery" to get started.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {items.map((item) => {
              const label = purchaseLabel(item);
              return (
                <div key={item.id} className="ab-card overflow-hidden">
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#ededed] truncate leading-tight">{item.title}</p>
                          <p className="text-[11px] text-[#6c6c73] mt-0.5 truncate leading-tight">{label}</p>
                          <p className="text-[11px] text-[#6c6c73] mt-0.5 leading-tight">{item.karat}K · {item.weightGrams.toFixed(2)} g</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.photoUrl && (
                            <button className="ab-btn ab-btn-ghost p-1" onClick={() => setPhotoUrl(item.photoUrl!)} title="View photo">
                              <Image size={13} />
                            </button>
                          )}
                          <button className="ab-btn ab-btn-ghost p-1" onClick={() => { setEditing(item); setDialogOpen(true); }} title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button className="ab-btn ab-btn-ghost p-1" onClick={() => remove(item.id)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-t border-[#1f1f23]">
                    <div className="px-3 py-2 border-r border-[#1f1f23]">
                      <p className="text-[10px] text-[#6c6c73] uppercase tracking-wide mb-0.5">Purchased</p>
                      <p className="mono text-[12px] text-[#ededed]">
                        {item.purchasePrice != null ? formatINR(item.purchasePrice) : "—"}
                      </p>
                    </div>
                    <div className="px-3 py-2 border-r border-[#1f1f23]">
                      <p className="text-[10px] text-[#6c6c73] uppercase tracking-wide mb-0.5">Current</p>
                      <p className="mono text-[12px] text-[#ededed]">
                        {item.currentValue != null ? formatINR(item.currentValue) : "—"}
                      </p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[10px] text-[#6c6c73] uppercase tracking-wide mb-0.5">Gain / Loss</p>
                      <p className={`mono text-[12px] ${gainColor(item.gainLoss)}`}>
                        {item.gainLoss != null ? formatINR(item.gainLoss) : "—"}
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="px-4 py-3 border-t border-[#1f1f23] text-[12px] text-[#a0a0a5] whitespace-pre-wrap">
                      {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block ab-card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] text-[#a0a0a5] uppercase tracking-wider">
                <tr className="border-b border-[#1f1f23]">
                  <th className="text-left p-3 pl-4">Title</th>
                  <th className="text-right p-3">Weight</th>
                  <th className="text-right p-3">Karat</th>
                  <th className="text-right p-3">Purchase Value</th>
                  <th className="text-right p-3">Current Value</th>
                  <th className="text-right p-3">Gain / Loss</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const label = purchaseLabel(item);
                  return (
                    <tr key={item.id} className="border-b border-[#1f1f23] hover:bg-[#15151a] transition-colors align-middle">
                      <td className="py-2 px-3 pl-4">
                        <p className="text-[13px] text-[#ededed] font-medium leading-tight">{item.title}</p>
                        <p className="text-[11px] text-[#6c6c73] mt-0.5 leading-tight">{label}</p>
                      </td>
                      <td className="py-2 px-3 mono text-right text-[13px] text-[#c0c0c6] whitespace-nowrap">{item.weightGrams.toFixed(2)} g</td>
                      <td className="py-2 px-3 mono text-right whitespace-nowrap">
                        <span className="bg-[#1f1f23] text-[#a0a0a5] text-[11px] px-1.5 py-0.5 rounded">
                          {item.karat}K
                        </span>
                      </td>
                      <td className="py-2 px-3 mono text-right text-[13px] text-[#c0c0c6] whitespace-nowrap">
                        {item.purchasePrice != null ? formatINR(item.purchasePrice) : "—"}
                      </td>
                      <td className="py-2 px-3 mono text-right text-[13px] text-[#ededed] whitespace-nowrap">
                        {item.currentValue != null ? formatINR(item.currentValue) : "—"}
                      </td>
                      <td className={`py-2 px-3 mono text-right text-[13px] font-medium whitespace-nowrap ${gainColor(item.gainLoss)}`}>
                        {item.gainLoss != null ? formatINR(item.gainLoss) : "—"}
                      </td>
                      <td className="py-2 px-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {item.photoUrl && (
                            <button className="ab-btn ab-btn-ghost" onClick={() => setPhotoUrl(item.photoUrl!)} title="View photo">
                              <Image size={13} />
                            </button>
                          )}
                          <button className="ab-btn ab-btn-ghost" onClick={() => { setEditing(item); setDialogOpen(true); }} title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button className="ab-btn ab-btn-ghost" onClick={() => remove(item.id)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dialogOpen && (
        <GoldFormDialog
          initial={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}
