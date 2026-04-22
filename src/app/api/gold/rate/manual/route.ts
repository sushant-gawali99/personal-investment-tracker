import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { setManualRate, clearManualRate } from "@/lib/gold-rate";

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const rate22kPerG = Number(body.rate22kPerG);
  const rate24kPerG = Number(body.rate24kPerG);
  if (!(rate22kPerG > 0) || !(rate24kPerG > 0)) {
    return NextResponse.json({ error: "Both rates must be positive numbers" }, { status: 400 });
  }
  const rate = await setManualRate({ rate22kPerG, rate24kPerG });
  return NextResponse.json(rate);
}

export async function DELETE() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  await clearManualRate();
  return NextResponse.json({ ok: true });
}
