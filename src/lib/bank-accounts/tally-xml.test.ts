import { describe, it, expect } from "vitest";
import { buildTallyXml } from "./tally-xml";
import type { LedgerConfig, TxnForExport } from "./tally-types";

const config: LedgerConfig = {
  bankLedgerName: "HDFC Savings",
  categoryMappings: [
    { categoryId: "cat1", tallyLedgerName: "Food Expenses", voucherType: "Payment" },
    { categoryId: null, tallyLedgerName: "Sundry Expenses", voucherType: "Payment" },
  ],
};

const debitTxn: TxnForExport = {
  id: "txn1",
  txnDate: new Date("2024-01-15T00:00:00.000Z"),
  description: "SWIGGY UPI",
  prettyDescription: "Swiggy Order",
  amount: 500,
  direction: "debit",
  categoryId: "cat1",
};

const creditTxn: TxnForExport = {
  id: "txn2",
  txnDate: new Date("2024-01-20T00:00:00.000Z"),
  description: "SALARY CREDIT",
  prettyDescription: null,
  amount: 50000,
  direction: "credit",
  categoryId: null,
};

describe("buildTallyXml", () => {
  it("wraps output in a valid Tally ERP 9 envelope", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
    expect(xml).toContain("<REPORTNAME>Vouchers</REPORTNAME>");
    expect(xml).toContain('<TALLYMESSAGE xmlns:UDF="TallyUDF">');
  });

  it("sets REMOTEID to the transaction id", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain('REMOTEID="txn1"');
  });

  it("formats DATE as YYYYMMDD with no separators", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<DATE>20240115</DATE>");
  });

  it("uses prettyDescription as NARRATION when available", () => {
    const xml = buildTallyXml([debitTxn], config);
    expect(xml).toContain("<NARRATION>Swiggy Order</NARRATION>");
  });

  it("falls back to description when prettyDescription is null", () => {
    const xml = buildTallyXml([creditTxn], config);
    expect(xml).toContain("<NARRATION>SALARY CREDIT</NARRATION>");
  });

  it("sets correct amounts and ISDEEMEDPOSITIVE for a debit transaction", () => {
    const xml = buildTallyXml([debitTxn], config);
    const catIdx = xml.indexOf("<LEDGERNAME>Food Expenses</LEDGERNAME>");
    const bankIdx = xml.indexOf("<LEDGERNAME>HDFC Savings</LEDGERNAME>");
    expect(catIdx).toBeGreaterThan(-1);
    expect(bankIdx).toBeGreaterThan(-1);
    expect(catIdx).toBeLessThan(bankIdx);
    const catBlock = xml.slice(catIdx, bankIdx);
    expect(catBlock).toContain("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>");
    expect(catBlock).toContain("<AMOUNT>-500.00</AMOUNT>");
    const bankBlock = xml.slice(bankIdx);
    expect(bankBlock).toContain("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>");
    expect(bankBlock).toContain("<AMOUNT>500.00</AMOUNT>");
  });

  it("sets correct amounts and ISDEEMEDPOSITIVE for a credit transaction", () => {
    const xml = buildTallyXml([creditTxn], config);
    const catIdx = xml.indexOf("<LEDGERNAME>Sundry Expenses</LEDGERNAME>");
    const bankIdx = xml.indexOf("<LEDGERNAME>HDFC Savings</LEDGERNAME>");
    const catBlock = xml.slice(catIdx, bankIdx);
    expect(catBlock).toContain("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>");
    expect(catBlock).toContain("<AMOUNT>50000.00</AMOUNT>");
    const bankBlock = xml.slice(bankIdx);
    expect(bankBlock).toContain("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>");
    expect(bankBlock).toContain("<AMOUNT>-50000.00</AMOUNT>");
  });

  it("maps uncategorized transactions (categoryId: null) to the null mapping", () => {
    const xml = buildTallyXml([creditTxn], config);
    expect(xml).toContain("<LEDGERNAME>Sundry Expenses</LEDGERNAME>");
  });

  it("escapes XML special characters in ledger names and narration", () => {
    const txn: TxnForExport = { ...debitTxn, prettyDescription: "AT&T <Payment>" };
    const cfg: LedgerConfig = {
      ...config,
      categoryMappings: [{ categoryId: "cat1", tallyLedgerName: "Food & Dining", voucherType: "Payment" }],
    };
    const xml = buildTallyXml([txn], cfg);
    expect(xml).toContain("AT&amp;T &lt;Payment&gt;");
    expect(xml).toContain("Food &amp; Dining");
  });

  it("throws when a transaction has no ledger mapping", () => {
    const unmapped: TxnForExport = { ...debitTxn, categoryId: "unknown-id" };
    expect(() => buildTallyXml([unmapped], config)).toThrow(
      "No ledger mapping for categoryId: unknown-id"
    );
  });

  it("generates one VOUCHER element per transaction", () => {
    const xml = buildTallyXml([debitTxn, creditTxn], config);
    const count = (xml.match(/<VOUCHER /g) ?? []).length;
    expect(count).toBe(2);
  });
});
