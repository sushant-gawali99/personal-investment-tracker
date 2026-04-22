import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as dotenv from "fs";

// Load .env.local manually since we're outside Next.js
(function loadEnv() {
  try {
    const content = require("fs").readFileSync(".env.local", "utf8") as string;
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // .env.local not present, rely on existing env
  }
})();

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const prisma = new PrismaClient({ adapter });

const PRESETS = [
  { name: "Grocery",         kind: "expense",  icon: "ShoppingCart",  color: "#22c55e", sortOrder: 10 },
  { name: "Food & Dining",   kind: "expense",  icon: "UtensilsCrossed", color: "#f97316", sortOrder: 20 },
  { name: "Petrol",          kind: "expense",  icon: "Fuel",          color: "#eab308", sortOrder: 30 },
  { name: "Medical",         kind: "expense",  icon: "HeartPulse",    color: "#ef4444", sortOrder: 40 },
  { name: "Utilities",       kind: "expense",  icon: "Zap",           color: "#0ea5e9", sortOrder: 50 },
  { name: "Rent",            kind: "expense",  icon: "Home",          color: "#8b5cf6", sortOrder: 60 },
  { name: "Travel",          kind: "expense",  icon: "Plane",         color: "#06b6d4", sortOrder: 70 },
  { name: "Shopping",        kind: "expense",  icon: "ShoppingBag",   color: "#ec4899", sortOrder: 80 },
  { name: "Entertainment",   kind: "expense",  icon: "Film",          color: "#a855f7", sortOrder: 90 },
  { name: "Salary",          kind: "income",   icon: "Banknote",      color: "#10b981", sortOrder: 100 },
  { name: "Interest",        kind: "income",   icon: "TrendingUp",    color: "#14b8a6", sortOrder: 110 },
  { name: "Refund",          kind: "income",   icon: "RotateCcw",     color: "#84cc16", sortOrder: 120 },
  { name: "Transfer",        kind: "transfer", icon: "ArrowLeftRight", color: "#6b7280", sortOrder: 200 },
];

async function main() {
  for (const p of PRESETS) {
    const existing = await prisma.transactionCategory.findFirst({
      where: { userId: null, name: p.name },
    });
    if (existing) {
      await prisma.transactionCategory.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.transactionCategory.create({ data: { ...p, userId: null } });
    }
  }
  console.log(`Seeded ${PRESETS.length} preset categories.`);
}

main().finally(() => prisma.$disconnect());
