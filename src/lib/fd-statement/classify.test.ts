import { describe, it, expect } from "vitest";
import { classifyRow } from "./classify";

describe("classifyRow", () => {
  it("classifies interest from 'Int. FD-999030244019507'", () => {
    expect(classifyRow("Int. FD-999030244019507")).toEqual({
      type: "interest",
      detectedFdNumber: "999030244019507",
    });
  });
  it("classifies interest from 'FD NO 16984 MAT INT'", () => {
    expect(classifyRow("FD NO 16984 MAT INT")).toEqual({
      type: "interest",
      detectedFdNumber: "16984",
    });
  });
  it("classifies maturity 'MAT FD 18883 CLSD'", () => {
    expect(classifyRow("MAT FD 18883 CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "18883",
    });
  });
  it("classifies maturity 'FD 11713 MAT AND CLSD'", () => {
    expect(classifyRow("FD 11713 MAT AND CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "11713",
    });
  });
  it("classifies premature from 'FD 999 PREMAT CLSD'", () => {
    expect(classifyRow("FD 999 PREMAT CLSD")).toEqual({
      type: "premature_close",
      detectedFdNumber: "999",
    });
  });
  it("classifies transfer_out 'TR TO FD 999030244024577'", () => {
    expect(classifyRow("TR TO FD 999030244024577")).toEqual({
      type: "transfer_out",
      detectedFdNumber: "999030244024577",
    });
  });
  it("classifies transfer_in 'Transfer fr FD-999030244023539'", () => {
    expect(classifyRow("Transfer fr FD-999030244023539")).toEqual({
      type: "transfer_in",
      detectedFdNumber: "999030244023539",
    });
  });
  it("classifies tds 'TDS Deducted-SB-DENGLE RAVINDRA'", () => {
    expect(classifyRow("TDS Deducted-SB-DENGLE RAVINDRA")).toEqual({
      type: "tds",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'Interest Post' without FD number", () => {
    expect(classifyRow("Interest Post")).toEqual({
      type: "other",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'To RD 999020244000802'", () => {
    const r = classifyRow("To RD 999020244000802");
    expect(r.type).toBe("other");
  });
});
