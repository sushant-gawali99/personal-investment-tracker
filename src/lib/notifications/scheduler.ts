import cron from "node-cron";
import { sendFdReminders } from "./fd-reminder-service";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // 9:00 AM IST = 3:30 AM UTC → cron in UTC: "30 3 * * *"
  cron.schedule("30 3 * * *", async () => {
    console.log("[Scheduler] Running FD maturity reminders");
    try {
      await sendFdReminders();
      console.log("[Scheduler] FD reminders completed");
    } catch (err) {
      console.error("[Scheduler] FD reminders failed:", err);
    }
  });

  console.log("[Scheduler] FD reminder cron registered (daily 09:00 IST)");
}
