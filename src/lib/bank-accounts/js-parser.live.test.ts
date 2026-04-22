import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseStatementText } from "./js-parser";
import { extractPdfText } from "./pdf-text";

describe("js-parser on real Axis statement (5265324706)", () => {
  it("parses the full statement without calling Claude", async () => {
    const pdf = readFileSync(path.join(__dirname, "__fixtures__/axis-march-2026.pdf"));
    const { text } = await extractPdfText(pdf);

    const t0 = Date.now();
    const r = parseStatementText(text);
    const elapsed = Date.now() - t0;

    console.log(`js-parser: ${elapsed}ms, ${r.transactions.length} txns, ${r.unparsedBlocks.length} unparsed`);
    if (r.unparsedBlocks.length > 0) {
      console.log("unparsed samples:");
      for (const u of r.unparsedBlocks.slice(0, 5)) console.log("  ", u.slice(0, 120));
    }

    expect(r.confident).toBe(true);
    expect(r.statementPeriodStart).toBe("2026-03-01");
    expect(r.statementPeriodEnd).toBe("2026-03-31");
    expect(r.transactions.length).toBeGreaterThan(100);
    // Every parsed transaction must have a date, amount, direction, and balance
    for (const t of r.transactions) {
      expect(t.txnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.amount).toBeGreaterThan(0);
      expect(["debit", "credit"]).toContain(t.direction);
      expect(t.runningBalance).not.toBeNull();
    }
    // Should be fast
    expect(elapsed).toBeLessThan(100);
  });
});
