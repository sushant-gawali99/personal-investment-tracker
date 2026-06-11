import { describe, it, expect } from "vitest";
import { buildFdDuplicateWhere } from "./fd-duplicate";

const userId = "user@example.com";
const base = {
  bankName: "State Bank of India",
  principal: 600000,
  startDate: new Date("2026-06-10"),
};

describe("buildFdDuplicateWhere", () => {
  it("matches an existing FD with the same fdNumber", () => {
    const where = buildFdDuplicateWhere(userId, { ...base, fdNumber: "45269559934" });
    expect(where.userId).toBe(userId);
    expect(where.OR).toContainEqual({ fdNumber: "45269559934" });
  });

  it("does not match same-bank/principal/startDate rows that carry a different fdNumber", () => {
    // Two distinct FDs opened the same day at the same bank for the same
    // amount differ only by fdNumber — the heuristic branch must be
    // restricted to rows without an fdNumber to compare against.
    const where = buildFdDuplicateWhere(userId, { ...base, fdNumber: "45269559934" });
    expect(where.OR).toContainEqual({ ...base, fdNumber: null });
    expect(where.OR).not.toContainEqual(base);
  });

  it("falls back to bank+principal+startDate against any row when no fdNumber is provided", () => {
    const where = buildFdDuplicateWhere(userId, { ...base, fdNumber: null });
    expect(where.OR).toEqual([base]);
  });

  it("treats an empty-string fdNumber as absent", () => {
    const where = buildFdDuplicateWhere(userId, { ...base, fdNumber: "" });
    expect(where.OR).toEqual([base]);
  });
});
