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
CREATE TABLE IF NOT EXISTS "UserProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "phone"  TEXT
)
`;

for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await client.execute(statement);
  console.log("✓", statement.slice(0, 80));
}

console.log("\nUserProfile table pushed to Turso successfully.");
