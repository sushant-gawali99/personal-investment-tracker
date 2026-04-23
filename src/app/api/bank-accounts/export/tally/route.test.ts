import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { transaction: { findMany: vi.fn() } },
}));
vi.mock("@/lib/bank-accounts/tally-xml", () => ({
  buildTallyXml: vi.fn().mockReturnValue("<ENVELOPE/>"),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

import { POST } from "./route";
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildTallyXml } from "@/lib/bank-accounts/tally-xml";

const validConfig = {
  bankLedgerName: "HDFC Savings",
  categoryMappings: [{ categoryId: null, tallyLedgerName: "Sundry", voucherType: "Payment" }],
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/bank-accounts/export/tally", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockTxn = {
  id: "t1",
  txnDate: new Date("2024-01-15T00:00:00.000Z"),
  description: "SWIGGY",
  prettyDescription: null,
  amount: 500,
  direction: "debit",
  categoryId: null,
};

describe("POST /api/bank-accounts/export/tally", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when bankLedgerName is empty", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    const res = await POST(
      makeReq({ filters: {}, ledgerConfig: { bankLedgerName: "  ", categoryMappings: [] } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Bank ledger name is required");
  });

  it("returns 400 when no transactions match the filters", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No transactions");
  });

  it("returns 400 when a transaction category has no mapping", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { ...mockTxn, categoryId: "unmapped-cat" },
    ] as never);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing ledger mapping");
  });

  it("returns XML file with correct headers when request is valid", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTxn] as never);
    const res = await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment.*\.xml/);
  });

  it("calls buildTallyXml with the fetched transactions and ledger config", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user1");
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([mockTxn] as never);
    await POST(makeReq({ filters: {}, ledgerConfig: validConfig }));
    expect(buildTallyXml).toHaveBeenCalledWith([mockTxn], validConfig);
  });
});
