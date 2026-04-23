import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-123" }, error: null });

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendFdReminderEmail } from "./email-service";
import { Resend } from "resend";

const mockFds = [
  {
    bankName: "HDFC Bank",
    fdNumber: "FD001",
    maturityDate: new Date("2026-05-03"),
    principal: 100000,
    maturityAmount: 105000,
    daysRemaining: 10,
  },
];

describe("sendFdReminderEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Resend emails.send with correct to address", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "reminders@test.com";

    await sendFdReminderEmail("user@example.com", mockFds);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("throws if Resend returns an error", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "bad" } });

    await expect(sendFdReminderEmail("user@example.com", mockFds)).rejects.toThrow("bad");
  });
});
