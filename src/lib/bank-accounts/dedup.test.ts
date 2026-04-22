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
    { id: "e1", bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY" },
    { id: "e2", bankRef: null,     txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART" },
  ];

  it("flags bankRef match", () => {
    const staged = [
      { bankRef: "UPI123", txnDate: "2026-04-01", amount: 100, normalizedDescription: "SWIGGY" },
      { bankRef: "UPI999", txnDate: "2026-04-03", amount: 500, normalizedDescription: "AMAZON" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e1");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("flags fallback key when bankRef is null", () => {
    const staged = [
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "DMART" },
      { bankRef: null, txnDate: "2026-04-02", amount: 250, normalizedDescription: "AMAZON" },
    ];
    const out = markDuplicates(staged, existing);
    expect(out[0].isDuplicate).toBe(true);
    expect(out[0].duplicateOfId).toBe("e2");
    expect(out[1].isDuplicate).toBe(false);
  });

  it("does not collide on bankRef when both sides have null", () => {
    const staged = [{ bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "X" }];
    const out = markDuplicates(staged, [{ id: "z", bankRef: null, txnDate: "2026-04-05", amount: 10, normalizedDescription: "Y" }]);
    expect(out[0].isDuplicate).toBe(false);
  });
});
