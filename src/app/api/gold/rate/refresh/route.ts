import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { refreshTodaysRate } from "@/lib/gold-rate";

export async function POST() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  try {
    const rate = await refreshTodaysRate();
    return NextResponse.json(rate);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scrape failed" }, { status: 502 });
  }
}
