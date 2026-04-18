import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
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
CREATE TABLE IF NOT EXISTS "FixedDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankName" TEXT NOT NULL,
    "fdNumber" TEXT,
    "accountNumber" TEXT,
    "principal" REAL NOT NULL,
    "interestRate" REAL NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "maturityDate" DATETIME NOT NULL,
    "maturityAmount" REAL,
    "interestType" TEXT NOT NULL DEFAULT 'compound',
    "compoundFreq" TEXT DEFAULT 'quarterly',
    "notes" TEXT,
    "sourceImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "KiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "accessToken" TEXT,
    "tokenExpiry" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
`;

for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await client.execute(statement);
  console.log("✓", statement.slice(0, 60));
}

console.log("\nSchema pushed to Turso successfully.");
