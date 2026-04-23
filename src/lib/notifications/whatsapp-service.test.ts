import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { sendFdReminderWhatsApp } from "./whatsapp-service";
import type { FdReminderItem } from "./email-service";

const mockFds: FdReminderItem[] = [
  {
    bankName: "SBI",
    fdNumber: null,
    maturityDate: new Date("2026-05-03"),
    principal: 50000,
    maturityAmount: 52500,
    daysRemaining: 10,
  },
];

describe("sendFdReminderWhatsApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("skips and does not call fetch when WHATSAPP_ENABLED is not true", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "false");
    await sendFdReminderWhatsApp("+919876543210", mockFds);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Meta Cloud API when WHATSAPP_ENABLED=true", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await sendFdReminderWhatsApp("+919876543210", mockFds);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/12345/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("throws when Meta API returns non-ok response", async () => {
    vi.stubEnv("WHATSAPP_ENABLED", "true");
    vi.stubEnv("WHATSAPP_TOKEN", "test-token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(sendFdReminderWhatsApp("+919876543210", mockFds)).rejects.toThrow("Invalid token");
  });
});
