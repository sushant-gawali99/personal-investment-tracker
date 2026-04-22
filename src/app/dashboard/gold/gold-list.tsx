"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { GoldItem } from "@prisma/client";
import type { GoldRatePayload } from "@/lib/gold-rate";
import { GoldFormDialog } from "./gold-form-dialog";

export type GoldRow = GoldItem & { currentValue: number | null; gainLoss: number | null };

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <>
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Items", value: String(summary.count) },
            { label: "Total Weight", value: `${summary.totalWeight.toFixed(2)} g` },
            { label: "Invested", value: summary.invested > 0 ? formatINR(summary.invested) : "—" },
            { label: "Current Value", value: initialRate ? formatINR(summary.currentValue) : "—" },
            {
              label: "Gain / Loss",
              value: summary.invested > 0 && initialRate
                ? `${formatINR(summary.gainLoss)} (${summary.gainLossPct.toFixed(2)}%)`
                : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="ab-card p-4">
              <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold mb-1">{label}</p>
              <p className="mono text-[18px] font-semibold text-[#ededed]">{value}</p>
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
        <div className="ab-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-[#a0a0a5] uppercase tracking-wider">
              <tr className="border-b border-[#1f1f23]">
                <th className="w-[30px]"></th>
                <th className="text-left p-3">Photo</th>
                <th className="text-left p-3">Title</th>
                <th className="text-right p-3">Weight (g)</th>
                <th className="text-right p-3">Karat</th>
                <th className="text-right p-3">Current Value</th>
                <th className="text-right p-3">Gain / Loss</th>
                <th className="w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const open = expanded.has(item.id);
                return (
                  <>
                    <tr key={item.id} className="border-b border-[#1f1f23] hover:bg-[#15151a]">
                      <td className="p-3">
                        <button onClick={() => toggle(item.id)} className="text-[#a0a0a5]">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="p-3">
                        {item.photoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={item.photoUrl} alt="" className="h-10 w-10 rounded object-cover" />
                          : <div className="h-10 w-10 rounded bg-[#15151a]" />}
                      </td>
                      <td className="p-3 text-[#ededed]">{item.title}</td>
                      <td className="p-3 mono text-right">{item.weightGrams.toFixed(2)}</td>
                      <td className="p-3 mono text-right">{item.karat}K</td>
                      <td className="p-3 mono text-right">{item.currentValue != null ? formatINR(item.currentValue) : "—"}</td>
                      <td className={"p-3 mono text-right " + (item.gainLoss == null ? "" : item.gainLoss >= 0 ? "text-[#5ee0a4]" : "text-[#ff6b7a]")}>
                        {item.gainLoss != null ? formatINR(item.gainLoss) : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <button className="ab-btn ab-btn-ghost" onClick={() => { setEditing(item); setDialogOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="ab-btn ab-btn-ghost ml-1" onClick={() => remove(item.id)} title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                    {open && (
                      <tr key={item.id + "-detail"} className="border-b border-[#1f1f23] bg-[#0f0f12]">
                        <td></td>
                        <td colSpan={7} className="p-4 text-[12px] text-[#a0a0a5] space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><span className="text-[#6c6c73]">Purchased on:</span> {item.purchasedOn ? new Date(item.purchasedOn).toLocaleDateString("en-IN") : "—"}</div>
                            <div><span className="text-[#6c6c73]">From:</span> {item.purchasedFrom ?? "—"}</div>
                            <div><span className="text-[#6c6c73]">Purchase price:</span> {item.purchasePrice != null ? formatINR(item.purchasePrice) : "—"}</div>
                            <div><span className="text-[#6c6c73]">Added:</span> {new Date(item.createdAt).toLocaleDateString("en-IN")}</div>
                          </div>
                          {item.notes && <div className="whitespace-pre-wrap">{item.notes}</div>}
                          {item.photoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photoUrl} alt="" className="max-h-60 rounded" />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
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
