import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram, type GoldRatePayload } from "@/lib/gold-rate";
import { GoldList } from "./gold-list";
import { RateChip } from "./rate-chip";

export default async function GoldPage() {
  const userId = (await getSessionUserId()) ?? "";
  const [items, rate] = await Promise.all([
    prisma.goldItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getTodaysRate(),
  ]);

  const enriched = items.map((item) => {
    let currentValue: number | null = null;
    let gainLoss: number | null = null;
    if (rate) {
      const perG = valuePerGram(item.karat, rate.rate22kPerG, rate.rate24kPerG);
      currentValue = perG * item.weightGrams;
      if (item.purchasePrice != null) gainLoss = currentValue - item.purchasePrice;
    }
    return { ...item, currentValue, gainLoss };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Gold</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">Track jewellery and see live IBJA gold valuation.</p>
      </div>

      <RateChip initial={rate as GoldRatePayload | null} />

      <GoldList initialItems={enriched} initialRate={rate} />
    </div>
  );
}
