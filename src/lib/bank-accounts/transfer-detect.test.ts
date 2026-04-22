import { describe, it, expect } from "vitest";
import { findTransferPairs } from "./transfer-detect";

type T = {
  id: string; accountId: string; txnDate: string; amount: number;
  direction: "debit" | "credit"; transferGroupId: string | null;
  categorySource: string | null; description: string;
};

describe("findTransferPairs", () => {
  it("matches debit A with credit B same day same amount", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "TO HDFC 1234" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "FROM ICICI" },
    ];
    const pairs = findTransferPairs(txns);
    expect(pairs.length).toBe(1);
    expect(pairs[0].debitId).toBe("d");
    expect(pairs[0].creditId).toBe("c");
  });

  it("matches within ±1 day", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-02", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns).length).toBe(1);
  });

  it("skips when same account", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "X" },
      { id: "c", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("skips when user already set category", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: "user", description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("skips when already grouped", () => {
    const txns: T[] = [
      { id: "d", accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: "g1", categorySource: null, description: "X" },
      { id: "c", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null,  categorySource: null, description: "Y" },
    ];
    expect(findTransferPairs(txns)).toEqual([]);
  });

  it("tiebreaks on closest date, then description-mentions-other-account", () => {
    const txns: T[] = [
      { id: "d",  accountId: "A", txnDate: "2026-04-01", amount: 5000, direction: "debit",  transferGroupId: null, categorySource: null, description: "TRF TO HDFC 1234" },
      { id: "c1", accountId: "B", txnDate: "2026-04-02", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "UNKNOWN" },
      { id: "c2", accountId: "B", txnDate: "2026-04-01", amount: 5000, direction: "credit", transferGroupId: null, categorySource: null, description: "UNKNOWN" },
    ];
    const pairs = findTransferPairs(txns);
    expect(pairs.length).toBe(1);
    expect(pairs[0].creditId).toBe("c2");
  });
});
