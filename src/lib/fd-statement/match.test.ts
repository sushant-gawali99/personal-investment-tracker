import { describe, it, expect } from "vitest";
import { matchFd } from "./match";
import type { MatchCandidate } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "a", fdNumber: "999030244019507", accountNumber: null, label: "FD A", maturityDate: "2026-12-01" },
  { fdId: "b", fdNumber: "999030244018883", accountNumber: null, label: "FD B", maturityDate: "2026-12-01" },
  { fdId: "c", fdNumber: "16984", accountNumber: null, label: "FD C", maturityDate: "2026-12-01" },
  { fdId: "d", fdNumber: null, accountNumber: "FD-13582", label: "FD D", maturityDate: "2026-12-01" },
];

describe("matchFd", () => {
  it("exact match on fdNumber", () => {
    expect(matchFd("999030244019507", fds)).toEqual({ kind: "matched", fdId: "a" });
  });
  it("exact match on accountNumber (ignoring prefix)", () => {
    expect(matchFd("FD-13582", fds)).toEqual({ kind: "matched", fdId: "d" });
  });
  it("suffix fallback: short detected suffix of stored fdNumber", () => {
    expect(matchFd("18883", fds)).toEqual({ kind: "matched", fdId: "b" });
  });
  it("suffix fallback: stored short fdNumber is suffix of detected long", () => {
    expect(matchFd("999930016984", fds)).toEqual({ kind: "matched", fdId: "c" });
  });
  it("none when no candidates", () => {
    expect(matchFd("11111", fds)).toEqual({ kind: "none" });
  });
  it("ambiguous when multiple suffixes match", () => {
    const ambig: MatchCandidate[] = [
      { fdId: "x", fdNumber: "123999", accountNumber: null, label: "X", maturityDate: "2026-01-01" },
      { fdId: "y", fdNumber: "456999", accountNumber: null, label: "Y", maturityDate: "2026-01-01" },
    ];
    expect(matchFd("999", ambig)).toEqual({ kind: "ambiguous", candidates: ["x", "y"] });
  });
  it("returns none when detected is null", () => {
    expect(matchFd(null, fds)).toEqual({ kind: "none" });
  });
});
