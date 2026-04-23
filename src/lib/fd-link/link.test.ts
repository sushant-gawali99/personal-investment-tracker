import { describe, it, expect } from "vitest";
import { linkTransactionToFd, type LinkableTxn } from "./link";
import type { MatchCandidate, FdTxnType } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "fd-a", fdNumber: "999030244019507", accountNumber: null },
  { fdId: "fd-b", fdNumber: "16984",           accountNumber: null },
];

const categories = new Map<FdTxnType, string>([
  ["interest",        "cat-interest"],
  ["maturity",        "cat-maturity"],
  ["premature_close", "cat-maturity"],
  ["tds",             "cat-tds"],
  ["transfer_in",     "cat-transfer"],
  ["transfer_out",    "cat-transfer"],
]);

function txn(description: string, direction: "debit" | "credit" = "credit"): LinkableTxn {
  return { description, direction };
}

describe("linkTransactionToFd", () => {
  it("links an interest credit with FD number match", () => {
    const r = linkTransactionToFd(txn("Int. FD-999030244019507"), fds, categories);
    expect(r).toEqual({ fdId: "fd-a", fdTxnType: "interest", categoryId: "cat-interest" });
  });

  it("links a maturity credit (suffix match)", () => {
    const r = linkTransactionToFd(txn("FD 16984 MAT CLSD"), fds, categories);
    expect(r).toEqual({ fdId: "fd-b", fdTxnType: "maturity", categoryId: "cat-maturity" });
  });

  it("returns null when no FD number present", () => {
    const r = linkTransactionToFd(txn("Salary credit"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null when FD number is present but matches no FD", () => {
    const r = linkTransactionToFd(txn("Int. FD-00000000"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null on an ambiguous suffix match", () => {
    const ambigFds: MatchCandidate[] = [
      { fdId: "x", fdNumber: "111999", accountNumber: null },
      { fdId: "y", fdNumber: "222999", accountNumber: null },
    ];
    const r = linkTransactionToFd(txn("Int. FD 999"), ambigFds, categories);
    expect(r).toBeNull();
  });

  it("does not link TDS rows (TDS descriptions don't carry an FD number)", () => {
    const r = linkTransactionToFd(txn("TDS Deducted-SB-DENGLE RAVINDRA", "debit"), fds, categories);
    // classify() returns tds + detectedFdNumber=null, so match is "none".
    expect(r).toBeNull();
  });

  it("does not link an 'other' classification even if FD number is present", () => {
    // "To RD" descriptions hit the fallthrough classifier → type "other".
    const r = linkTransactionToFd(txn("To RD 999030244019507"), fds, categories);
    expect(r).toBeNull();
  });

  it("returns null when the resolved type has no category in the map", () => {
    const partial = new Map<FdTxnType, string>([["interest", "cat-interest"]]);
    const r = linkTransactionToFd(txn("FD 16984 MAT CLSD"), fds, partial);
    expect(r).toBeNull();
  });
});
