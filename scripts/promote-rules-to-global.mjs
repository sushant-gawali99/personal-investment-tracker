// scripts/promote-rules-to-global.mjs
//
// Copy MerchantRule rows from one user (identified by email) into the
// system-wide rule set (userId = null). Safe to re-run: if a global rule
// with the same pattern + categoryId already exists, it is skipped.
//
// Usage:
//   USER_EMAIL=sushant.gawali@gmail.com node scripts/promote-rules-to-global.mjs
//   USER_EMAIL=... DRY_RUN=1 node scripts/promote-rules-to-global.mjs
//   USER_EMAIL=... DELETE_ORIGINALS=1 node scripts/promote-rules-to-global.mjs
//
// By default we keep the user's copies around so deleting globals later
// doesn't orphan anyone. DELETE_ORIGINALS=1 removes them after promotion.
//
// Personal-looking rules (landlord/person names, residential society
// patterns) are skipped by default — see PERSONAL_HINTS below. Set
// INCLUDE_ALL=1 to promote everything.
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

const email = process.env.USER_EMAIL;
const dryRun = process.env.DRY_RUN === "1";
const deleteOriginals = process.env.DELETE_ORIGINALS === "1";
const includeAll = process.env.INCLUDE_ALL === "1";

if (!email) {
  console.error("USER_EMAIL is required. e.g. USER_EMAIL=you@example.com node scripts/promote-rules-to-global.mjs");
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Patterns that probably don't generalise — landlord names, apartments,
// specific residential societies. These won't be promoted unless
// INCLUDE_ALL=1 is set.
const PERSONAL_HINTS = [
  /\bDEVELOPERS?\b/i,      // housing builders
  /\bBUILDERS?\b/i,
  /\bSOCIETY\b/i,
  /\bAPARTMENTS?\b/i,
  /\bRESIDEN(CY|TIAL|TS?)\b/i,
  /\bLANDLORD\b/i,
  /\bPAYING GUEST\b/i,
  /\bPG\b/i,
];

function looksPersonal(pattern) {
  return PERSONAL_HINTS.some((rx) => rx.test(pattern));
}

// In this project there's no User table — getSessionUserId() returns the
// email string directly, and MerchantRule.userId stores that email.
const userId = email;
console.log(`→ Promoting rules for user ${email} (userId is the email itself)`);

// Sanity check: confirm this user actually has rules before continuing.
const check = await client.execute({
  sql: `SELECT COUNT(*) as c FROM "MerchantRule" WHERE userId = ?`,
  args: [userId],
});
if (Number(check.rows[0].c) === 0) {
  console.error(`No MerchantRule rows found with userId=${userId}. Nothing to promote.`);
  process.exit(1);
}

// 2. Fetch their rules.
const ruleRows = await client.execute({
  sql: `SELECT id, pattern, categoryId, matchCount FROM "MerchantRule" WHERE userId = ?`,
  args: [userId],
});
if (ruleRows.rows.length === 0) {
  console.log("• This user has no rules to promote.");
  process.exit(0);
}

// 3. Fetch existing global rule patterns so we can dedupe.
const existingGlobals = await client.execute({
  sql: `SELECT pattern, categoryId FROM "MerchantRule" WHERE userId IS NULL`,
  args: [],
});
const globalKeys = new Set(
  existingGlobals.rows.map((r) => `${r.pattern}::${r.categoryId}`),
);

let promoted = 0;
let skippedDupe = 0;
let skippedPersonal = 0;
const promotedIds = [];

for (const r of ruleRows.rows) {
  const key = `${r.pattern}::${r.categoryId}`;
  if (globalKeys.has(key)) {
    skippedDupe += 1;
    continue;
  }
  if (!includeAll && looksPersonal(r.pattern)) {
    skippedPersonal += 1;
    console.log(`  skip personal: ${r.pattern}`);
    continue;
  }
  if (dryRun) {
    console.log(`  [dry-run] would promote: ${r.pattern}`);
  } else {
    // cuid()-ish id via a random prefix; MerchantRule.id is arbitrary TEXT.
    const newId = `cgb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await client.execute({
      sql: `INSERT INTO "MerchantRule"
            (id, userId, pattern, categoryId, matchCount, createdFromTransactionId, createdAt, updatedAt)
            VALUES (?, NULL, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [newId, r.pattern, r.categoryId],
    });
    globalKeys.add(key);
    promotedIds.push(r.id);
  }
  promoted += 1;
}

console.log(`\n${dryRun ? "[dry-run] " : ""}Promoted ${promoted}, skipped ${skippedDupe} duplicate + ${skippedPersonal} personal.`);

if (deleteOriginals && !dryRun && promotedIds.length > 0) {
  const placeholders = promotedIds.map(() => "?").join(",");
  const res = await client.execute({
    sql: `DELETE FROM "MerchantRule" WHERE id IN (${placeholders})`,
    args: promotedIds,
  });
  console.log(`Deleted ${res.rowsAffected} original user-scoped rules.`);
}
