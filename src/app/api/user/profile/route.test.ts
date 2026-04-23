import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      upsert: vi.fn(),
    },
  },
}));

import { PATCH } from "./route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ phone: "+91123" }));
    expect(res.status).toBe(401);
  });

  it("upserts phone and returns 200", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "user@example.com" } } as never);
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({
      userId: "user@example.com",
      phone: "+919876543210",
    });

    const res = await PATCH(makeReq({ phone: "+919876543210" }));
    expect(res.status).toBe(200);
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user@example.com" },
      create: { userId: "user@example.com", phone: "+919876543210" },
      update: { phone: "+919876543210" },
    });
  });

  it("allows clearing phone with null", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: "user@example.com" } } as never);
    vi.mocked(prisma.userProfile.upsert).mockResolvedValue({
      userId: "user@example.com",
      phone: null,
    });

    const res = await PATCH(makeReq({ phone: null }));
    expect(res.status).toBe(200);
    expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user@example.com" },
      create: { userId: "user@example.com", phone: null },
      update: { phone: null },
    });
  });
});
