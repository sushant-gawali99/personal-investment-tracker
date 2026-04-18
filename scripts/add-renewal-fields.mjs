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

const columns = [
  ["maturityInstruction", "TEXT"],
  ["payoutFrequency", "TEXT"],
  ["nomineeName", "TEXT"],
  ["nomineeRelation", "TEXT"],
];

const existing = await client.execute(`PRAGMA table_info("FixedDeposit")`);
const existingNames = new Set(existing.rows.map((r) => r.name));

for (const [name, type] of columns) {
  if (existingNames.has(name)) {
    console.log(`• ${name} already exists, skipping`);
    continue;
  }
  await client.execute(`ALTER TABLE "FixedDeposit" ADD COLUMN "${name}" ${type}`);
  console.log(`✓ added ${name}`);
}

console.log("\nDone.");
