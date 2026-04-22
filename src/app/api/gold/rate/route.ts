import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getTodaysRate } from "@/lib/gold-rate";

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const rate = await getTodaysRate();
  if (!rate) return NextResponse.json({ error: "No rate available. Set a manual rate or retry." }, { status: 503 });
  return NextResponse.json(rate);
}
