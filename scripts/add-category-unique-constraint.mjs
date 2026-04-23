#!/usr/bin/env node
// One-shot: add UNIQUE (userId, name) on TransactionCategory.
// SQLite can't add a constraint via ALTER TABLE ADD CONSTRAINT — we create
// a unique index instead, which has the same enforcement semantics and is
// what Prisma's @@unique([userId, name]) generates under the hood for SQLite.
// Safe to re-run: uses IF NOT EXISTS.

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Guard: refuse to run if duplicates exist — caller must resolve them first.
const dupes = await client.execute(
  `SELECT userId, name, COUNT(*) AS c FROM TransactionCategory GROUP BY userId, name HAVING c > 1`
);
if (dupes.rows.length > 0) {
  console.error("Duplicate (userId, name) rows exist — resolve before adding the unique index:");
  console.table(dupes.rows);
  process.exit(1);
}

await client.execute(
  `CREATE UNIQUE INDEX IF NOT EXISTS "TransactionCategory_userId_name_key" ON "TransactionCategory"("userId", "name")`
);

console.log("✔ TransactionCategory_userId_name_key created (or already present)");
