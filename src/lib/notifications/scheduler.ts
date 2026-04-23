import cron from "node-cron";
import { sendFdReminders } from "./fd-reminder-service";

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Running FD maturity reminders");
    try {
      await sendFdReminders();
      console.log("[Scheduler] FD reminders completed");
    } catch (err) {
      console.error("[Scheduler] FD reminders failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log("[Scheduler] FD reminder cron registered (daily 09:00 IST)");
}
