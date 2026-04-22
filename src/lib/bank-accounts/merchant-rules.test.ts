import { describe, it, expect } from "vitest";
import { applyRules, suggestPattern, isPatternTooBroad } from "./merchant-rules";

describe("applyRules", () => {
  const rules = [
    { id: "r1", pattern: "SWIGGY", categoryId: "food" },
    { id: "r2", pattern: "SWIGGY INSTAMART", categoryId: "grocery" },
    { id: "r3", pattern: "AMAZON*", categoryId: "shopping" },
  ];

  it("returns null when no rule matches", () => {
    expect(applyRules("FLIPKART", rules)).toBeNull();
  });
  it("longer pattern wins over shorter", () => {
    expect(applyRules("SWIGGY INSTAMART BANGALORE", rules)).toBe("grocery");
  });
  it("matches plain substring case-insensitive", () => {
    expect(applyRules("UPI/swiggy/tx1", rules)).toBe("food");
  });
  it("supports * wildcard", () => {
    expect(applyRules("AMAZON PAY INDIA", rules)).toBe("shopping");
  });
});

describe("suggestPattern", () => {
  it("strips trailing digits and ref ids", () => {
    expect(suggestPattern("SWIGGY BANGALORE 123456789012")).toBe("SWIGGY BANGALORE");
  });
  it("keeps core merchant token", () => {
    expect(suggestPattern("UPI/DMART KORAMANGALA/TXN")).toBe("UPI/DMART KORAMANGALA/TXN");
  });
  it("collapses whitespace", () => {
    expect(suggestPattern("DMART   42   ")).toBe("DMART 42");
  });
});

describe("isPatternTooBroad", () => {
  const all = ["SWIGGY BANGALORE", "SWIGGY PUNE", "AMAZON", "DMART"];
  it("rejects patterns shorter than 3 chars", () => {
    expect(isPatternTooBroad("AB", all)).toBe(true);
  });
  it("rejects patterns matching > 50%", () => {
    expect(isPatternTooBroad("S", all)).toBe(true);
    expect(isPatternTooBroad("A", all)).toBe(true);
  });
  it("accepts specific patterns", () => {
    expect(isPatternTooBroad("SWIGGY", all)).toBe(false);
  });
});
