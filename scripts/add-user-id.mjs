import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, "../.env"), "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// FixedDeposit: add userId column
const fdInfo = await client.execute(`PRAGMA table_info("FixedDeposit")`);
const fdCols = new Set(fdInfo.rows.map((r) => r.name));
if (!fdCols.has("userId")) {
  await client.execute(`ALTER TABLE "FixedDeposit" ADD COLUMN "userId" TEXT NOT NULL DEFAULT ''`);
  console.log("✓ FixedDeposit.userId added");
} else {
  console.log("• FixedDeposit.userId already exists");
}

// KiteConfig: recreate with userId as PK
const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='KiteConfig'`);
if (tables.rows.length > 0) {
  const kcInfo = await client.execute(`PRAGMA table_info("KiteConfig")`);
  const kcCols = new Set(kcInfo.rows.map((r) => r.name));

  if (!kcCols.has("userId")) {
    // Migrate: rename old table, create new one with userId PK
    await client.execute(`ALTER TABLE "KiteConfig" RENAME TO "KiteConfig_old"`);
    await client.execute(`
      CREATE TABLE "KiteConfig" (
        "userId"      TEXT NOT NULL PRIMARY KEY,
        "apiKey"      TEXT NOT NULL,
        "apiSecret"   TEXT NOT NULL,
        "accessToken" TEXT,
        "tokenExpiry" DATETIME,
        "updatedAt"   DATETIME NOT NULL
      )
    `);
    console.log("✓ KiteConfig recreated with userId PK (old data dropped — please reconnect Kite)");
  } else {
    console.log("• KiteConfig.userId already exists");
  }
}
