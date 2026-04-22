#!/usr/bin/env node
// One-shot: create FDStatement + FDStatementTxn tables in Turso.
// Safe to re-run (IF NOT EXISTS / IF NOT EXISTS on indexes).

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load .env manually (no dotenv dep)
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL not set");
  process.exit(1);
}

const client = createClient({ url, authToken });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "FDStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourcePdfUrl" TEXT NOT NULL,
    "fromDate" DATETIME,
    "toDate" DATETIME,
    "txnCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "parseMethod" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "FDStatement_userId_bankName_idx" ON "FDStatement"("userId", "bankName")`,

  `CREATE TABLE IF NOT EXISTS "FDStatementTxn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "fdId" TEXT,
    "txnDate" DATETIME NOT NULL,
    "particulars" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "detectedFdNumber" TEXT,
    CONSTRAINT "FDStatementTxn_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "FDStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FDStatementTxn_fdId_fkey" FOREIGN KEY ("fdId") REFERENCES "FixedDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "FDStatementTxn_fdId_txnDate_idx" ON "FDStatementTxn"("fdId", "txnDate")`,
  `CREATE INDEX IF NOT EXISTS "FDStatementTxn_statementId_idx" ON "FDStatementTxn"("statementId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FDStatementTxn_statementId_txnDate_particulars_debit_credit_key" ON "FDStatementTxn"("statementId", "txnDate", "particulars", "debit", "credit")`,
];

for (const sql of STATEMENTS) {
  process.stdout.write(sql.split("\n")[0].slice(0, 80) + "…\n");
  await client.execute(sql);
}
console.log("✔ FD statement schema applied to Turso");
