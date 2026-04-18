import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Drop renewedFromId column (SQLite doesn't support DROP COLUMN easily, so we leave it — it's nullable and harmless)
// Create FDRenewal table
await client.execute(`
  CREATE TABLE IF NOT EXISTS FDRenewal (
    id              TEXT PRIMARY KEY,
    fdId            TEXT NOT NULL REFERENCES FixedDeposit(id) ON DELETE CASCADE,
    renewalNumber   INTEGER NOT NULL,
    startDate       DATETIME NOT NULL,
    maturityDate    DATETIME NOT NULL,
    principal       REAL NOT NULL,
    interestRate    REAL NOT NULL,
    tenureMonths    INTEGER NOT NULL,
    maturityAmount  REAL,
    maturityInstruction TEXT,
    payoutFrequency TEXT,
    createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

await client.execute(`CREATE INDEX IF NOT EXISTS FDRenewal_fdId_idx ON FDRenewal(fdId)`);

console.log("Created FDRenewal table");
await client.close();
