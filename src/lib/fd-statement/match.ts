import type { MatchCandidate, MatchResult } from "./types";

export function matchFd(detected: string | null, fds: MatchCandidate[]): MatchResult {
  if (!detected) return { kind: "none" };
  const d = detected.replace(/^FD[-\s]?/i, "");
  const exact = fds.filter((f) => f.fdNumber === d || f.accountNumber === d || f.accountNumber === detected);
  if (exact.length === 1) return { kind: "matched", fdId: exact[0].fdId };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact.map((f) => f.fdId) };

  const suffix = fds.filter((f) => {
    if (!f.fdNumber) return false;
    return f.fdNumber.endsWith(d) || d.endsWith(f.fdNumber);
  });
  if (suffix.length === 1) return { kind: "matched", fdId: suffix[0].fdId };
  if (suffix.length > 1) return { kind: "ambiguous", candidates: suffix.map((f) => f.fdId) };
  return { kind: "none" };
}
