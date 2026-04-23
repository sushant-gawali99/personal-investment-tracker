import { describe, it, expect } from "vitest";
import { matchFd } from "./match";
import type { MatchCandidate } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "a", fdNumber: "999030244019507", accountNumber: null },
  { fdId: "b", fdNumber: "999030244018883", accountNumber: null },
  { fdId: "c", fdNumber: "16984",           accountNumber: null },
  { fdId: "d", fdNumber: null,              accountNumber: "FD-13582" },
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
      { fdId: "x", fdNumber: "123999", accountNumber: null },
      { fdId: "y", fdNumber: "456999", accountNumber: null },
    ];
    expect(matchFd("999", ambig)).toEqual({ kind: "ambiguous", candidates: ["x", "y"] });
  });
  it("returns none when detected is null", () => {
    expect(matchFd(null, fds)).toEqual({ kind: "none" });
  });
});
