import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixedDeposit: { findMany: vi.fn() },
    userProfile: { findMany: vi.fn() },
  },
}));
vi.mock("./email-service", () => ({ sendFdReminderEmail: vi.fn() }));
vi.mock("./whatsapp-service", () => ({ sendFdReminderWhatsApp: vi.fn() }));

import { getISTDateRange, sendFdReminders } from "./fd-reminder-service";
import { prisma } from "@/lib/prisma";
import { sendFdReminderEmail } from "./email-service";
import { sendFdReminderWhatsApp } from "./whatsapp-service";

describe("getISTDateRange", () => {
  it("returns a 24-hour window for the given day offset", () => {
    const { gte, lt } = getISTDateRange(0);
    const diff = lt.getTime() - gte.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("returns a range 10 days ahead of today", () => {
    const { gte: today } = getISTDateRange(0);
    const { gte: tenDays } = getISTDateRange(10);
    const diff = tenDays.getTime() - today.getTime();
    expect(diff).toBe(10 * 24 * 60 * 60 * 1000);
  });
});

describe("sendFdReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email and whatsapp for each user with maturing FDs", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      {
        id: "fd1", userId: "alice@example.com", bankName: "HDFC", fdNumber: "001",
        principal: 100000, maturityAmount: 105000,
        maturityDate: new Date(), disabled: false,
      },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([
      { userId: "alice@example.com", phone: "+919876543210" },
    ] as never);
    vi.mocked(sendFdReminderEmail).mockResolvedValue(undefined);
    vi.mocked(sendFdReminderWhatsApp).mockResolvedValue(undefined);

    await sendFdReminders();

    expect(sendFdReminderEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.arrayContaining([expect.objectContaining({ bankName: "HDFC" })])
    );
    expect(sendFdReminderWhatsApp).toHaveBeenCalledWith(
      "+919876543210",
      expect.arrayContaining([expect.objectContaining({ bankName: "HDFC" })])
    );
  });

  it("skips WhatsApp when user has no phone", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      {
        id: "fd2", userId: "bob@example.com", bankName: "SBI", fdNumber: null,
        principal: 50000, maturityAmount: null,
        maturityDate: new Date(), disabled: false,
      },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);
    vi.mocked(sendFdReminderEmail).mockResolvedValue(undefined);
    vi.mocked(sendFdReminderWhatsApp).mockResolvedValue(undefined);

    await sendFdReminders();

    expect(sendFdReminderEmail).toHaveBeenCalledWith("bob@example.com", expect.any(Array));
    expect(sendFdReminderWhatsApp).not.toHaveBeenCalled();
  });

  it("continues processing other users if one throws", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([
      { id: "fd3", userId: "err@example.com", bankName: "ICICI", fdNumber: null, principal: 10000, maturityAmount: null, maturityDate: new Date(), disabled: false },
      { id: "fd4", userId: "ok@example.com", bankName: "Axis", fdNumber: null, principal: 20000, maturityAmount: null, maturityDate: new Date(), disabled: false },
    ] as never);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);
    vi.mocked(sendFdReminderEmail)
      .mockRejectedValueOnce(new Error("Resend error"))
      .mockResolvedValueOnce(undefined);

    await sendFdReminders(); // should not throw

    expect(sendFdReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no FDs are maturing", async () => {
    vi.mocked(prisma.fixedDeposit.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userProfile.findMany).mockResolvedValue([]);

    await sendFdReminders();

    expect(sendFdReminderEmail).not.toHaveBeenCalled();
    expect(sendFdReminderWhatsApp).not.toHaveBeenCalled();
  });
});
