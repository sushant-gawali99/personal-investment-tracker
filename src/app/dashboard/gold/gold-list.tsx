"use client";

import type { GoldItem } from "@prisma/client";
import type { GoldRatePayload } from "@/lib/gold-rate";

export type GoldRow = GoldItem & { currentValue: number | null; gainLoss: number | null };

export function GoldList({
  initialItems,
}: {
  initialItems: GoldRow[];
  initialRate: GoldRatePayload | null;
}) {
  if (initialItems.length === 0) {
    return <div className="ab-card p-10 text-center text-[#a0a0a5]">No jewellery yet.</div>;
  }
  return (
    <div className="ab-card p-4">
      <pre className="text-[12px] text-[#a0a0a5] overflow-auto">{JSON.stringify(initialItems, null, 2)}</pre>
    </div>
  );
}
