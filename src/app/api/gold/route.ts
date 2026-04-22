import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getTodaysRate, valuePerGram } from "@/lib/gold-rate";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

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

  return NextResponse.json({ items: enriched, rate });
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const body = await req.json();
  const { title, weightGrams, karat, photoUrl, purchasedOn, purchasedFrom, purchasePrice, notes } = body;

  if (!title || typeof title !== "string") return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const w = Number(weightGrams);
  if (!(w > 0)) return NextResponse.json({ error: "Weight (g) must be positive" }, { status: 400 });
  const k = Number(karat);
  if (![24, 22, 18, 14].includes(k)) return NextResponse.json({ error: "Karat must be 24, 22, 18, or 14" }, { status: 400 });

  const item = await prisma.goldItem.create({
    data: {
      userId,
      title: title.trim().slice(0, 200),
      weightGrams: w,
      karat: k,
      photoUrl: typeof photoUrl === "string" && photoUrl ? photoUrl : null,
      purchasedOn: purchasedOn ? new Date(purchasedOn) : null,
      purchasedFrom: typeof purchasedFrom === "string" && purchasedFrom.trim() ? purchasedFrom.trim().slice(0, 200) : null,
      purchasePrice: purchasePrice != null && purchasePrice !== "" ? Number(purchasePrice) : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
