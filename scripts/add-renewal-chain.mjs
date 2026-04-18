import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.execute(`
  ALTER TABLE FixedDeposit ADD COLUMN renewedFromId TEXT REFERENCES FixedDeposit(id)
`);

console.log("Added renewedFromId column to FixedDeposit");
await client.close();
