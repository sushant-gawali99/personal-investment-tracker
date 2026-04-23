#!/usr/bin/env node
// One-shot: drop FDStatement + FDStatementTxn tables, add fdId/fdTxnType
// columns (+ index) on Transaction.
// Safe to re-run: uses DROP/ADD IF [NOT] EXISTS where supported.

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

// SQLite ALTER TABLE ... ADD COLUMN doesn't support IF NOT EXISTS; we detect
// via PRAGMA table_info.
async function columnExists(table, column) {
  const res = await client.execute(`PRAGMA table_info("${table}")`);
  return res.rows.some((r) => r.name === column);
}

async function indexExists(name) {
  const res = await client.execute(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
    [name]
  );
  return res.rows.length > 0;
}

async function run(sql, label) {
  process.stdout.write((label ?? sql.split("\n")[0].slice(0, 80)) + "…\n");
  await client.execute(sql);
}

// 1. Drop FDStatementTxn first (it references FDStatement + FixedDeposit).
await run(`DROP TABLE IF EXISTS "FDStatementTxn"`);
// 2. Drop FDStatement.
await run(`DROP TABLE IF EXISTS "FDStatement"`);

// 3. Add fdId + fdTxnType columns on Transaction (SQLite can't add a FK
//    constraint via ALTER TABLE; the Prisma client enforces the relation
//    logically, which matches how other relations on this table are handled).
if (!(await columnExists("Transaction", "fdId"))) {
  await run(`ALTER TABLE "Transaction" ADD COLUMN "fdId" TEXT`);
} else {
  console.log("- Transaction.fdId already exists, skipping");
}

if (!(await columnExists("Transaction", "fdTxnType"))) {
  await run(`ALTER TABLE "Transaction" ADD COLUMN "fdTxnType" TEXT`);
} else {
  console.log("- Transaction.fdTxnType already exists, skipping");
}

// 4. Index on fdId.
if (!(await indexExists("Transaction_fdId_idx"))) {
  await run(`CREATE INDEX "Transaction_fdId_idx" ON "Transaction"("fdId")`);
} else {
  console.log("- Transaction_fdId_idx already exists, skipping");
}

console.log("\n✔ FD-statement tables dropped; fdId/fdTxnType added to Transaction");
