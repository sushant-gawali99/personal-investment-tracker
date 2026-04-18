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

const existing = await client.execute(`PRAGMA table_info("FixedDeposit")`);
const names = new Set(existing.rows.map((r) => r.name));

if (!names.has("sourceImageBackUrl")) {
  await client.execute(`ALTER TABLE "FixedDeposit" ADD COLUMN "sourceImageBackUrl" TEXT`);
  console.log("✓ added sourceImageBackUrl");
} else {
  console.log("• sourceImageBackUrl already exists");
}
