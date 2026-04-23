import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the route
vi.mock("@/lib/session", () => ({
  getSessionUserId: vi.fn(),
  isSupAdmin: vi.fn(),
  SUPER_ADMIN_EMAIL: "sushant.gawali@gmail.com",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    statementImport: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/bank-accounts/run-extraction", () => ({
  runExtraction: vi.fn(),
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

import { POST } from "./route";
import { getSessionUserId, isSupAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runExtraction } from "@/lib/bank-accounts/run-extraction";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/bank-accounts/import/${id}/reimport`, { method: "POST" });
}

describe("POST /api/bank-accounts/import/[id]/reimport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not super admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "other@example.com" } });
    vi.mocked(isSupAdmin).mockReturnValue(false);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when import not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } });
    vi.mocked(isSupAdmin).mockReturnValue(true);
    vi.mocked(getSessionUserId).mockResolvedValue("sushant.gawali@gmail.com");
    vi.mocked(prisma.statementImport.findFirst).mockResolvedValue(null);
    const res = await POST(makeReq("abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(404);
  });

  it("returns 202, deletes transactions, resets import, and fires runExtraction", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } });
    vi.mocked(isSupAdmin).mockReturnValue(true);
    vi.mocked(getSessionUserId).mockResolvedValue("sushant.gawali@gmail.com");
    vi.mocked(prisma.statementImport.findFirst).mockResolvedValue({
      id: "imp1", userId: "sushant.gawali@gmail.com",
    } as never);
    vi.mocked(prisma.transaction.deleteMany).mockResolvedValue({ count: 5 });
    vi.mocked(prisma.statementImport.update).mockResolvedValue({} as never);
    vi.mocked(runExtraction).mockResolvedValue(undefined);

    const res = await POST(makeReq("imp1"), { params: Promise.resolve({ id: "imp1" }) });

    expect(res.status).toBe(202);
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { importId: "imp1", userId: "sushant.gawali@gmail.com" },
    });
    expect(prisma.statementImport.update).toHaveBeenCalledWith({
      where: { id: "imp1" },
      data: {
        status: "extracting",
        newCount: 0,
        extractedCount: 0,
        duplicateCount: 0,
        stagedTransactions: null,
        errorMessage: null,
      },
    });
    expect(runExtraction).toHaveBeenCalledWith("imp1", "sushant.gawali@gmail.com");
  });

  it("returns 202 with alreadyRunning when already extracting", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "sushant.gawali@gmail.com" } } as never);
    vi.mocked(isSupAdmin).mockReturnValue(true);
    vi.mocked(getSessionUserId).mockResolvedValue("sushant.gawali@gmail.com");
    vi.mocked(prisma.statementImport.findFirst).mockResolvedValue({
      id: "imp1", userId: "sushant.gawali@gmail.com", status: "extracting",
    } as never);
    const res = await POST(makeReq("imp1"), { params: Promise.resolve({ id: "imp1" }) });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.alreadyRunning).toBe(true);
    expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
  });
});
