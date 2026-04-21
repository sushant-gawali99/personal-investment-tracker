import { prisma } from "@/lib/prisma";
import { createKiteClient } from "@/lib/kite";

export async function syncKiteData(userId: string): Promise<void> {
  const config = await prisma.kiteConfig.findUnique({ where: { userId } });
  if (!config?.accessToken) throw new Error("Not connected to Zerodha.");

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
}
