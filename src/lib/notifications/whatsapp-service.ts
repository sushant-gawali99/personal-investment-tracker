import type { FdReminderItem } from "./email-service";

function buildMessageText(fds: FdReminderItem[]): string {
  const lines = fds.map((fd) => {
    const label = fd.fdNumber ? `${fd.bankName} (${fd.fdNumber})` : fd.bankName;
    const date = fd.maturityDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const principal = `₹${fd.principal.toLocaleString("en-IN")}`;
    const amount = fd.maturityAmount
      ? ` → ₹${fd.maturityAmount.toLocaleString("en-IN")}`
      : "";
    return `• ${label}\n  Matures: ${date} (${fd.daysRemaining} days)\n  Principal: ${principal}${amount}`;
  });

  return `*FD Maturity Reminder* 🔔\n\n${lines.join("\n\n")}\n\nLog in to your Investment Tracker to take action.`;
}

export async function sendFdReminderWhatsApp(
  phone: string,
  fds: FdReminderItem[]
): Promise<void> {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    console.log(`[WhatsApp] Skipped for ${phone}: WHATSAPP_ENABLED is not true`);
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: buildMessageText(fds) },
  };

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error?.message ?? `WhatsApp API error: ${res.status}`);
  }
}
