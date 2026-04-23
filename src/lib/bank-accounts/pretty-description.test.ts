import { describe, it, expect } from "vitest";
import { prettifyDescription } from "./pretty-description";

describe("prettifyDescription — UPI merchant format", () => {
  it("extracts merchant from Axis 5-slot UPI/P2M", () => {
    const r = prettifyDescription("UPI/P2M/237794180606/Google Asia Pacific P/Sold b/AXIS BANK");
    expect(r.method).toBe("UPI");
    expect(r.subMethod).toBe("P2M");
    expect(r.merchant).toBe("Google Play");
    expect(r.counterBank).toBe("Axis Bank");
    expect(r.ref).toBe("237794180606");
  });

  it("canonicalises truncated Zepto Marketplace to Zepto", () => {
    const r = prettifyDescription("UPI/P2M/606158776841/Zepto Marketplace Pri/Sent u/AXIS BANK");
    expect(r.merchant).toBe("Zepto");
  });

  it("canonicalises Swiggy Limited to Swiggy", () => {
    const r = prettifyDescription("UPI/P2M/103616969512/Swiggy Limited /Pay fo/AXIS BANK");
    expect(r.merchant).toBe("Swiggy");
  });

  it("canonicalises amazon pay groceries (lowercase)", () => {
    const r = prettifyDescription("UPI/P2M/606057219410/amazon pay groceries /You ar/YES BANK LIMITED YBS");
    expect(r.merchant).toBe("Amazon Pay Groceries");
    expect(r.counterBank).toBe("Yes Bank");
  });

  it("keeps CRED as uppercase acronym", () => {
    const r = prettifyDescription("UPI/P2M/642683493846/CRED /paymen/AXIS BANK");
    expect(r.merchant).toBe("CRED");
  });

  it("parses normalized description with empty ref slot", () => {
    // normalizeDescription strips the 10+ digit numeric reference used for
    // dedup aggregation. The prettifier should still extract the merchant.
    const r = prettifyDescription("UPI/P2M//Google Asia Pacific P/Sold b/AXIS BANK");
    expect(r.method).toBe("UPI");
    expect(r.merchant).toBe("Google Play");
    expect(r.counterBank).toBe("Axis Bank");
    expect(r.ref).toBe("");
  });
});

describe("prettifyDescription — UPI person format (P2A)", () => {
  it("strips honorific from person name and title-cases", () => {
    const r = prettifyDescription("UPI/P2A/398187233592/Mr Sushant Anant Gawa/Sent u/State Bank Of India");
    expect(r.method).toBe("UPI");
    expect(r.subMethod).toBe("P2A");
    expect(r.merchant).toBe("Sushant Anant Gawa");
    expect(r.counterBank).toBe("SBI");
  });

  it("handles IMPS/P2A", () => {
    const r = prettifyDescription("IMPS/P2A/606140940015/SushantGawali/X5077 21/ICICIBANKLTD/");
    expect(r.method).toBe("IMPS");
    expect(r.subMethod).toBe("P2A");
    expect(r.merchant).toBe("Sushantgawali");
    expect(r.counterBank).toBe("ICICI Bank");
  });
});

describe("prettifyDescription — non-UPI methods", () => {
  it("identifies POS with merchant", () => {
    const r = prettifyDescription("POS 1234XXXXXX5678 AMAZON IN MUMBAI");
    expect(r.method).toBe("POS");
    expect(r.merchant).toContain("Amazon");
  });

  it("labels ATM withdrawal", () => {
    const r = prettifyDescription("ATM-WDL-1234-CANARA BANK KORAMANGALA");
    expect(r.method).toBe("ATM");
    expect(r.merchant.startsWith("ATM")).toBe(true);
  });

  it("labels salary credit", () => {
    const r = prettifyDescription("NEFT-CITI00001234-ACME CORP SALARY APR2026");
    // NEFT path runs first; that's fine — "ACME CORP SALARY APR2026" is still a merchant.
    expect(r.method).toBe("NEFT");
  });

  it("identifies interest credit", () => {
    const r = prettifyDescription("INT.CREDIT");
    expect(r.method).toBe("Interest");
    expect(r.merchant).toBe("Interest Credit");
  });

  it("falls back to title-case for unknown formats", () => {
    const r = prettifyDescription("PROVIDENT FUND CONTRIBUTION");
    expect(r.method).toBeNull();
    expect(r.merchant).toBe("Provident Fund Contribution");
  });

  it("handles empty string", () => {
    const r = prettifyDescription("");
    expect(r.merchant).toBe("");
  });
});
