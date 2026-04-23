// src/app/api/bank-accounts/transactions/ai-categorize/route.ts
//
// Auto-categorise uncategorised transactions by asking Claude to cluster
// their normalised descriptions into merchant patterns, then persisting
// each cluster as a MerchantRule and applying it to the whole history.
//
// Constraints (per product spec):
//   * evaluates ONLY transactions with categoryId=null
//   * no review/confirmation UI — results are applied directly
//   * every accepted AI suggestion becomes a persistent MerchantRule
//   * the new rules also re-categorise any future/past rows that match
//
// Strategy: we iterate in rounds. Each round fetches the *current* set of
// uncategorised descriptions (up to BATCH_SIZE) and asks Claude for rules.
// After applying a round's rules, many more rows may drop out of the
// "uncategorised" set, so we loop until either (a) no rows remain,
// (b) Claude stops producing new rules, or (c) MAX_ROUNDS is hit.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { suggestRulesFromDescriptions } from "@/lib/bank-accounts/ai-categorize";
import { isPatternTooBroad } from "@/lib/bank-accounts/merchant-rules";

// Distinct descriptions sent to Claude per round. Keeping this moderate
// gives Claude space to respond with detailed suggestions without hitting
// output-token truncation.
const BATCH_SIZE = 150;
// Safety cap — one POST call will never exceed this many AI roundtrips.
const MAX_ROUNDS = 6;

interface SkippedEntry {
  pattern: string;
  category?: string;
  reason: string;
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load the user's category list ONCE — presets + custom categories.
  // We refresh the name-keyed map each round since the AI may add new
  // categories.
  const categories = await prisma.transactionCategory.findMany({
    where: { OR: [{ userId: null }, { userId }], disabled: false },
    select: { id: true, name: true, kind: true },
  });
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  // Existing rule patterns — refreshed each round as we add to them.
  // Union the user's rules with the system-wide set so we don't
  // re-create a rule that already exists as a global.
  const existingRulesRows = await prisma.merchantRule.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    select: { pattern: true },
  });
  const existingPatterns = new Set(existingRulesRows.map((r) => r.pattern));

  // All user descriptions for the too-broad guard. These don't change
  // during this run, so we compute once.
  const allDescRows = await prisma.transaction.findMany({
    where: { userId },
    select: { normalizedDescription: true },
  });
  const allDescriptions = allDescRows.map((r) => r.normalizedDescription);

  let rulesCreated = 0;
  let categoriesCreated = 0;
  let transactionsCategorised = 0;
  let suggestionsReceived = 0;
  const skipped: SkippedEntry[] = [];
  const rounds: Array<{
    round: number;
    descriptions: number;
    suggestions: number;
    rulesCreated: number;
    txnsCategorised: number;
  }> = [];

  // Track descriptions Claude has already seen this run. If a round comes
  // back with zero new rules AND the same unhandled descriptions, we stop.
  const seenDescriptions = new Set<string>();

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    // Fetch *current* uncategorised descriptions — after the previous
    // round's rules were applied, this set shrinks.
    const uncategorised = await prisma.transaction.findMany({
      where: { userId, categoryId: null },
      select: { normalizedDescription: true },
      distinct: ["normalizedDescription"],
      take: BATCH_SIZE * 2,
    });

    // Drop descriptions Claude has already seen this run to avoid looping
    // on the same "too ambiguous" ones forever. Keep up to BATCH_SIZE.
    const freshDescriptions = uncategorised
      .map((u) => u.normalizedDescription)
      .filter((d) => !seenDescriptions.has(d))
      .slice(0, BATCH_SIZE);

    if (freshDescriptions.length === 0) {
      // Nothing new to analyse — either done or only ambiguous rows remain.
      break;
    }

    for (const d of freshDescriptions) seenDescriptions.add(d);

    const suggestions = await suggestRulesFromDescriptions(
      freshDescriptions,
      categories.map((c) => ({ name: c.name, kind: c.kind })),
    );
    suggestionsReceived += suggestions.length;

    let roundRulesCreated = 0;
    let roundTxnsCategorised = 0;

    for (const s of suggestions) {
      const pattern = s.pattern.trim().toUpperCase();

      // Resolve or create the category.
      let cat = categoryByName.get(s.category.toLowerCase());
      if (!cat && s.isNewCategory && s.categoryKind) {
        const created = await prisma.transactionCategory.create({
          data: {
            userId,
            name: s.category.trim(),
            kind: s.categoryKind,
          },
          select: { id: true, name: true, kind: true },
        });
        categoryByName.set(created.name.toLowerCase(), created);
        cat = created;
        categoriesCreated += 1;
      }
      if (!cat) {
        skipped.push({ pattern, category: s.category, reason: "unknown category" });
        continue;
      }

      if (existingPatterns.has(pattern)) {
        skipped.push({ pattern, category: s.category, reason: "rule already exists" });
        continue;
      }
      if (isPatternTooBroad(pattern, allDescriptions)) {
        skipped.push({ pattern, category: s.category, reason: "pattern too broad" });
        continue;
      }

      // Apply to every still-uncategorised txn matching this pattern.
      // User-labelled rows are authoritative and left alone.
      const bareSubstring = pattern.replace(/\*/g, "");
      const updated = await prisma.transaction.updateMany({
        where: {
          userId,
          normalizedDescription: { contains: bareSubstring },
          categorySource: { not: "user" },
        },
        data: { categoryId: cat.id, categorySource: "rule" },
      });

      await prisma.merchantRule.create({
        data: {
          userId,
          pattern,
          categoryId: cat.id,
          matchCount: updated.count,
        },
      });
      existingPatterns.add(pattern);
      roundRulesCreated += 1;
      roundTxnsCategorised += updated.count;
    }

    rulesCreated += roundRulesCreated;
    transactionsCategorised += roundTxnsCategorised;
    rounds.push({
      round,
      descriptions: freshDescriptions.length,
      suggestions: suggestions.length,
      rulesCreated: roundRulesCreated,
      txnsCategorised: roundTxnsCategorised,
    });

    // If Claude produced zero useful rules this round, stop — running
    // again on fresh (still-uncategorised) descriptions would just surface
    // the same P2P / ambiguous rows.
    if (roundRulesCreated === 0) break;
  }

  // Final sweep: re-apply EVERY rule (old + newly created) to any txns
  // still lacking a category. This catches cases like "ZEPTO" being created
  // after a per-row update missed a sibling description (e.g. "Zeptonow"),
  // and keeps the engine output consistent with what a fresh import would
  // produce. We look at rows with categoryId=null regardless of source —
  // those are the rows that need help.
  const stillUncategorised = await prisma.transaction.findMany({
    where: { userId, categoryId: null },
    select: { id: true, normalizedDescription: true },
  });
  if (stillUncategorised.length > 0) {
    const allRules = await prisma.merchantRule.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, pattern: true, categoryId: true },
    });
    // Longest pattern wins — mirrors applyRules().
    const sortedRules = [...allRules].sort(
      (a, b) => b.pattern.length - a.pattern.length,
    );
    const extraByCategory = new Map<string, string[]>();
    for (const t of stillUncategorised) {
      for (const r of sortedRules) {
        const bare = r.pattern.replace(/\*/g, "");
        if (t.normalizedDescription.includes(bare)) {
          const list = extraByCategory.get(r.categoryId) ?? [];
          list.push(t.id);
          extraByCategory.set(r.categoryId, list);
          break;
        }
      }
    }
    for (const [categoryId, ids] of extraByCategory) {
      if (ids.length === 0) continue;
      const res = await prisma.transaction.updateMany({
        where: { id: { in: ids } },
        data: { categoryId, categorySource: "rule" },
      });
      transactionsCategorised += res.count;
    }
  }

  // Count how many txns remain uncategorised so the UI can show the user
  // whether another run is worth trying, and sample a few distinct
  // descriptions so the user can eyeball what Claude is still missing.
  const remainingUncategorised = await prisma.transaction.count({
    where: { userId, categoryId: null },
  });
  const remainingSamples = await prisma.transaction.findMany({
    where: { userId, categoryId: null },
    select: { normalizedDescription: true },
    distinct: ["normalizedDescription"],
    take: 20,
  });

  return NextResponse.json({
    rulesCreated,
    categoriesCreated,
    transactionsCategorised,
    suggestionsReceived,
    remainingUncategorised,
    remainingSamples: remainingSamples.map((r) => r.normalizedDescription),
    rounds,
    skipped,
  });
}
