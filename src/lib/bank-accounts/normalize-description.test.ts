import { describe, it, expect } from "vitest";
import { normalizeDescription } from "./normalize-description";

describe("normalizeDescription", () => {
  it("uppercases and trims", () => {
    expect(normalizeDescription("  swiggy bangalore  ")).toBe("SWIGGY BANGALORE");
  });
  it("strips long digit ref ids (>=10 digits)", () => {
    expect(normalizeDescription("UPI/SWIGGY/1234567890123/PAYMENT")).toBe("UPI/SWIGGY//PAYMENT");
  });
  it("keeps short numbers (e.g. store numbers)", () => {
    expect(normalizeDescription("DMART 42 KORAMANGALA")).toBe("DMART 42 KORAMANGALA");
  });
  it("collapses repeated whitespace", () => {
    expect(normalizeDescription("HDFC   ATM\t\tWITHDRAWAL")).toBe("HDFC ATM WITHDRAWAL");
  });
  it("returns empty for empty input", () => {
    expect(normalizeDescription("")).toBe("");
  });
});
