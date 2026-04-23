// scripts/make-merchant-rule-userid-nullable.mjs
//
// SQLite cannot `ALTER COLUMN ... DROP NOT NULL`, so we recreate the
// MerchantRule table with a nullable userId, copy rows, and swap.
// Idempotent: skips if userId is already nullable.
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

const info = await client.execute(`PRAGMA table_info("MerchantRule")`);
const userIdCol = info.rows.find((r) => r.name === "userId");
if (!userIdCol) {
  console.log("• MerchantRule table does not exist; nothing to migrate.");
  process.exit(0);
}
if (userIdCol.notnull === 0 || userIdCol.notnull === 0n) {
  console.log("• MerchantRule.userId is already nullable. No-op.");
  process.exit(0);
}

console.log("→ Recreating MerchantRule with nullable userId…");

// 1. Create a new table with the desired schema.
await client.execute(`
  CREATE TABLE "MerchantRule_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdFromTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("categoryId") REFERENCES "TransactionCategory"("id") ON DELETE CASCADE
  )
`);

// 2. Copy rows.
await client.execute(`
  INSERT INTO "MerchantRule_new"
    (id, userId, pattern, categoryId, matchCount, createdFromTransactionId, createdAt, updatedAt)
  SELECT id, userId, pattern, categoryId, matchCount, createdFromTransactionId, createdAt, updatedAt
  FROM "MerchantRule"
`);

// 3. Swap.
await client.execute(`DROP TABLE "MerchantRule"`);
await client.execute(`ALTER TABLE "MerchantRule_new" RENAME TO "MerchantRule"`);

// 4. Recreate the index.
await client.execute(`CREATE INDEX "MerchantRule_userId_idx" ON "MerchantRule"("userId")`);

const count = await client.execute(`SELECT COUNT(*) AS n FROM "MerchantRule"`);
console.log(`✓ MerchantRule recreated with nullable userId (${count.rows[0].n} rows preserved).`);
