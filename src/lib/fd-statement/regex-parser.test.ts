import { describe, it, expect } from "vitest";
import { parseStatementText } from "./regex-parser";

const SAMPLE = `
TRN-DATE TRN-PARTICULARS CA/TR DEBIT CREDIT BALANCE
01-Jul-2024 Int. FD-999030244019507 Tr 0.00 4121.00 44761.00
05-Apr-2024 To RD 9990244000802 Tr 5500.00 0.00 68140.00
24-Mar-2025 MAT FD 18883 CLSD Tr 0.00 200000.00 219268.00
31-Mar-2026 TDS Deducted-SB-DENGLE RAVINDRA DIWAKAR Tr 1464.00 0.00 65330.00
`;

describe("parseStatementText", () => {
  it("extracts rows with date + particulars + amounts", () => {
    const rows = parseStatementText(SAMPLE);
    expect(rows.length).toBe(4);
    expect(rows[0]).toMatchObject({
      txnDate: "2024-07-01",
      debit: 0,
      credit: 4121,
      type: "interest",
      detectedFdNumber: "999030244019507",
    });
    expect(rows[2]).toMatchObject({ type: "maturity", credit: 200000 });
    expect(rows[3]).toMatchObject({ type: "tds", debit: 1464 });
  });

  it("handles split-line dates like '07-\\nMay-2024'", () => {
    const text = `07-\nMay-2024 Int. FD-999030244019507 Tr 0.00 100.00 1000.00`;
    const rows = parseStatementText(text);
    expect(rows.length).toBe(1);
    expect(rows[0].txnDate).toBe("2024-05-07");
  });

  it("returns empty array for empty text", () => {
    expect(parseStatementText("")).toEqual([]);
  });
});
