#!/usr/bin/env node
// Add opening/closing balance columns to StatementImport. Idempotent.

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

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function columnExists(table, column) {
  const res = await client.execute(`PRAGMA table_info("${table}")`);
  return res.rows.some((r) => r.name === column);
}

for (const col of ["openingBalance", "closingBalance"]) {
  if (!(await columnExists("StatementImport", col))) {
    await client.execute(`ALTER TABLE "StatementImport" ADD COLUMN "${col}" REAL`);
    console.log(`✔ added StatementImport.${col}`);
  } else {
    console.log(`- StatementImport.${col} already exists, skipping`);
  }
}
