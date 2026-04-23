import { prisma } from "@/lib/prisma";
import { sendFdReminderEmail, type FdReminderItem } from "./email-service";
import { sendFdReminderWhatsApp } from "./whatsapp-service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export function getISTDateRange(daysFromNow: number): { gte: Date; lt: Date } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const gte = new Date(
    Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate() + daysFromNow) - IST_OFFSET_MS
  );
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

export async function sendFdReminders(): Promise<void> {
  const window10 = getISTDateRange(10);
  const window5 = getISTDateRange(5);

  const fds = await prisma.fixedDeposit.findMany({
    where: {
      disabled: false,
      OR: [
        { maturityDate: window10 },
        { maturityDate: window5 },
      ],
    },
    select: {
      id: true,
      userId: true,
      bankName: true,
      fdNumber: true,
      maturityDate: true,
      principal: true,
      maturityAmount: true,
    },
  });

  if (fds.length === 0) return;

  const userIds = [...new Set(fds.map((fd) => fd.userId))];
  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, phone: true },
  });
  const phoneByUserId = new Map(profiles.map((p) => [p.userId, p.phone]));

  const byUser = new Map<string, typeof fds>();
  for (const fd of fds) {
    const list = byUser.get(fd.userId) ?? [];
    list.push(fd);
    byUser.set(fd.userId, list);
  }

  for (const [userId, userFds] of byUser) {
    const items: FdReminderItem[] = userFds.map((fd) => ({
      bankName: fd.bankName,
      fdNumber: fd.fdNumber,
      maturityDate: fd.maturityDate,
      principal: fd.principal,
      maturityAmount: fd.maturityAmount,
      daysRemaining: fd.maturityDate >= window10.gte && fd.maturityDate < window10.lt ? 10 : 5,
    }));

    try {
      await sendFdReminderEmail(userId, items);
    } catch (err) {
      console.error(`[FD reminders] Email failed for ${userId}:`, err);
    }

    const phone = phoneByUserId.get(userId);
    if (phone) {
      try {
        await sendFdReminderWhatsApp(phone, items);
      } catch (err) {
        console.error(`[FD reminders] WhatsApp failed for ${userId}:`, err);
      }
    }
  }
}
