import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

import { GET } from "./route";
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function makeReq(qs = "") {
  return new NextRequest(
    `http://localhost/api/bank-accounts/export/tally/categories${qs ? `?${qs}` : ""}`
  );
}

describe("GET /api/bank-accounts/export/tally/categories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns categories and hasUncategorized=false when all are categorized", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { categoryId: "cat1", category: { id: "cat1", name: "Food", kind: "expense" } },
      { categoryId: "cat2", category: { id: "cat2", name: "Salary", kind: "income" } },
    ] as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasUncategorized).toBe(false);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0]).toEqual({ categoryId: "cat1", categoryName: "Food", kind: "expense" });
  });

  it("returns hasUncategorized=true when some transactions have no category", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { categoryId: null, category: null },
      { categoryId: "cat1", category: { id: "cat1", name: "Food", kind: "expense" } },
    ] as never);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.hasUncategorized).toBe(true);
    expect(body.categories).toHaveLength(1);
  });

  it("passes accountId filter to Prisma", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    await GET(makeReq("accountId=acc123"));
    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc123" }) })
    );
  });
});
