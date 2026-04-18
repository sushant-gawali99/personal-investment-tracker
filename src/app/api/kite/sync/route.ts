import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";
import { requireUserId } from "@/lib/session";

export async function POST() {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config?.accessToken) {
    return NextResponse.json({ error: "Not connected to Zerodha." }, { status: 400 });
  }
  if (config.tokenExpiry && new Date(config.tokenExpiry) < new Date()) {
    return NextResponse.json({ error: "Session expired. Please reconnect." }, { status: 401 });
  }

  try {
    const kc = createKiteClient(config.apiKey);
    kc.setAccessToken(config.accessToken);
    const [holdings, positions, mfHoldings] = await Promise.all([
      kc.getHoldings(),
      kc.getPositions(),
      kc.getMFHoldings(),
    ]);

    const syncedAt = new Date();
    await prisma.kiteSnapshot.upsert({
      where: { userId },
      create: {
        userId,
        holdingsJson: JSON.stringify(holdings),
        positionsJson: JSON.stringify(positions),
        mfHoldingsJson: JSON.stringify(mfHoldings),
        syncedAt,
      },
      update: {
        holdingsJson: JSON.stringify(holdings),
        positionsJson: JSON.stringify(positions),
        mfHoldingsJson: JSON.stringify(mfHoldings),
        syncedAt,
      },
    });

    return NextResponse.json({ syncedAt });
  } catch {
    return NextResponse.json({ error: "Failed to sync from Zerodha." }, { status: 500 });
  }
}
