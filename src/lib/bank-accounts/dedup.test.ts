import { describe, it, expect } from "vitest";
import { markDuplicates, amountToPaise } from "./dedup";

describe("amountToPaise", () => {
  it("converts rupees to integer paise", () => {
    expect(amountToPaise(123.45)).toBe(12345);
    expect(amountToPaise(0)).toBe(0);
    expect(amountToPaise(1)).toBe(100);
  });
  it("rounds float noise", () => {
    expect(amountToPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("markDuplicates", () => {
  const existing = [
    { id: "e1", bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY", direction: "debit" },
    { id: "e2", bankRef: null,     txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART",  direction: "debit" },
  ];

  it("flags bankRef match for same direction", () => {
    const staged = [
      { bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY", direction: "debit" },
      { bankRef: "UPI999", txnDate: "2026-04-03", amount: 500, normalizedDescription: "AMAZON", direction: "debit" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e1");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("does not flag bankRef match when direction differs (reversal)", () => {
    const staged = [
      { bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "IMPS REV SWIGGY", direction: "credit" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(false);
  });

  it("flags fallback key when bankRef is null", () => {
    const staged = [
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART",  direction: "debit" },
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "AMAZON", direction: "debit" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e2");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("does not collide on bankRef when both sides have null", () => {
    const staged = [{ bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "X", direction: "debit" }];
    const out = markDuplicates(staged, [{ id: "z", bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "Y", direction: "debit" }]);
    expect(out[0].isDuplicate).toBe(false);
  });
});
