import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = `
CREATE TABLE IF NOT EXISTS "BankAlert" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "emailMessageId"   TEXT NOT NULL,
  "emailDate"        DATETIME NOT NULL,
  "txnTime"          DATETIME,
  "direction"        TEXT NOT NULL,
  "amount"           REAL NOT NULL,
  "merchant"         TEXT,
  "accountLast4"     TEXT,
  "availableBalance" REAL,
  "channel"          TEXT,
  "rawSubject"       TEXT,
  "rawSnippet"       TEXT,
  "parseStatus"      TEXT NOT NULL DEFAULT 'parsed',
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankAlert_userId_emailMessageId_key" ON "BankAlert"("userId", "emailMessageId");
CREATE INDEX IF NOT EXISTS "BankAlert_userId_emailDate_idx" ON "BankAlert"("userId", "emailDate");
`;

for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await client.execute(statement);
  console.log("✓", statement.slice(0, 80));
}

console.log("\nBankAlert table pushed to Turso successfully.");
