import { Resend } from "resend";

export interface FdReminderItem {
  bankName: string;
  fdNumber: string | null;
  maturityDate: Date;
  principal: number;
  maturityAmount: number | null;
  daysRemaining: number;
}

export async function sendFdReminderEmail(to: string, fds: FdReminderItem[]): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const fdRows = fds
    .map((fd) => {
      const label = fd.fdNumber ? `${fd.bankName} — ${fd.fdNumber}` : fd.bankName;
      const maturity = fd.maturityDate.toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      const principal = `₹${fd.principal.toLocaleString("en-IN")}`;
      const amount = fd.maturityAmount
        ? `₹${fd.maturityAmount.toLocaleString("en-IN")}`
        : "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${maturity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${principal}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e">${amount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a2e;font-weight:600;color:${fd.daysRemaining <= 5 ? "#ff7a6e" : "#f5a623"}">${fd.daysRemaining} days</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#ededed;background:#16161a;padding:32px;border-radius:12px">
      <h2 style="margin-top:0">FD Maturity Reminder</h2>
      <p style="color:#a0a0a5">The following Fixed Deposits are maturing soon:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="color:#a0a0a5;font-size:12px;text-transform:uppercase">
            <th style="padding:8px 12px;text-align:left">FD</th>
            <th style="padding:8px 12px;text-align:left">Maturity Date</th>
            <th style="padding:8px 12px;text-align:left">Principal</th>
            <th style="padding:8px 12px;text-align:left">Maturity Amount</th>
            <th style="padding:8px 12px;text-align:left">Days Left</th>
          </tr>
        </thead>
        <tbody>${fdRows}</tbody>
      </table>
      <p style="color:#a0a0a5;font-size:12px;margin-top:24px">Sent by your Investment Tracker.</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "reminders@yourdomain.com",
    to,
    subject: `FD Maturity Reminder — ${fds.length} FD${fds.length > 1 ? "s" : ""} maturing soon`,
    html,
  });

  if (error) throw new Error(error.message);
}
