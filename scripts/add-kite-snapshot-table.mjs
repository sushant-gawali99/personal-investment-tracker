import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.execute(`
  CREATE TABLE IF NOT EXISTS KiteSnapshot (
    userId          TEXT PRIMARY KEY,
    holdingsJson    TEXT NOT NULL,
    positionsJson   TEXT NOT NULL,
    mfHoldingsJson  TEXT NOT NULL,
    syncedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("Created KiteSnapshot table");
await client.close();
