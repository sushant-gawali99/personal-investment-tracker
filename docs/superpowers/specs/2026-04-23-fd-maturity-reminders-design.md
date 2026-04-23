# FD Maturity Reminders — Design Spec

**Date:** 2026-04-23  
**Status:** Approved

---

## Overview

Send automated email and WhatsApp reminders to users when their Fixed Deposits are approaching maturity. Reminders fire at 10 days and 5 days before the maturity date. The system runs as an in-process daily cron job on the Railway-hosted Next.js server.

---

## Architecture

```
instrumentation.ts
  └── src/lib/notifications/scheduler.ts     (node-cron, daily at 9:00 AM IST)
        └── src/lib/notifications/fd-reminder-service.ts
              ├── prisma                      (query maturing FDs + user contact info)
              ├── src/lib/notifications/email-service.ts    (Resend)
              └── src/lib/notifications/whatsapp-service.ts (Meta Cloud API, env-gated)
```

### Startup

`instrumentation.ts` is Next.js's official server-side init hook. The scheduler is registered there under a `NEXT_RUNTIME === 'nodejs'` guard so it only runs in the Node.js runtime, not the Edge runtime.

A module-level boolean flag prevents duplicate cron registrations on hot reload in development.

---

## Core Reminder Logic

The `fd-reminder-service` runs once per day and:

1. Queries all non-disabled FDs where `maturityDate` falls **exactly 10 days** or **exactly 5 days** from today. Date comparison uses **IST (UTC+5:30)** — compute today's date in IST, then match FDs whose maturity date (stored as UTC midnight) falls on the target IST calendar date.
2. Groups matching FDs by `userId`.
3. For each user, sends **one combined email** listing all their FDs in both windows — not one email per FD.
4. If the user has a `phone` set, also sends **one combined WhatsApp message**.
5. Each user is processed in an independent try/catch — one failure does not block others.

### Message Content (per FD)

- Bank name
- FD number (if set)
- Maturity date
- Principal amount
- Maturity amount (if set)
- Days remaining (10 or 5)

---

## Data Model Changes

### `User` model — add `phone` field

```prisma
model User {
  // ...existing fields...
  phone  String?   // WhatsApp-capable number in international format, e.g. "+919876543210"
}
```

---

## Profile Settings UI

A new **"Notification Settings"** section on the existing `/dashboard/settings` page:

- Phone number input (international format, e.g. `+91...`)
- Save button — PATCHes `PATCH /api/user/profile`
- No opt-out toggles — reminders always go to login email; WhatsApp fires only if `phone` is set

### New API Route

`PATCH /api/user/profile` — updates `phone` on the authenticated user.

---

## Email Service (Resend)

- Provider: **Resend** (`resend` npm package)
- Free tier: 3,000 emails/month — sufficient for a personal multi-user tracker
- One email per user per day (combined, covering both the 10-day and 5-day windows if applicable)
- From address configured via `RESEND_FROM_EMAIL` env var

---

## WhatsApp Service (Meta Cloud API)

The service is **fully implemented but env-gated**:

- `WHATSAPP_ENABLED=false` (default) → logs "WhatsApp skipped: not configured" and returns
- `WHATSAPP_ENABLED=true` + token set → calls Meta Cloud API `/messages` endpoint

This means no code changes are needed when the WhatsApp Business Account (WABA) is approved — flip the env var and it activates.

Uses **free-form text messages** (not templates) for flexibility. Note: Meta Cloud API requires template messages for outbound messages to users who haven't messaged first in 24h — this should be revisited when setting up WABA.

---

## Environment Variables

```env
# Email
RESEND_API_KEY=              # Resend API key
RESEND_FROM_EMAIL=           # e.g. "reminders@yourdomain.com"

# WhatsApp (set when WABA is ready)
WHATSAPP_ENABLED=false
WHATSAPP_TOKEN=              # Meta Cloud API bearer token
WHATSAPP_PHONE_NUMBER_ID=    # From Meta developer dashboard
```

---

## Error Handling

- Per-user try/catch: one user's failure is logged but does not block others
- Errors logged to `console.error` with `userId` and FD context
- Resend / WhatsApp API errors are caught, logged, and do not throw
- If a user has no email (defensive case), skip silently

---

## Files To Create / Modify

| Path | Action |
|---|---|
| `src/lib/notifications/scheduler.ts` | Create — node-cron setup, double-start guard |
| `src/lib/notifications/fd-reminder-service.ts` | Create — core query + dispatch logic |
| `src/lib/notifications/email-service.ts` | Create — Resend integration |
| `src/lib/notifications/whatsapp-service.ts` | Create — Meta Cloud API, env-gated |
| `instrumentation.ts` | Create (or modify if exists) — register scheduler |
| `prisma/schema.prisma` | Modify — add `phone` to `User` model |
| `src/app/api/user/profile/route.ts` | Create — PATCH handler for phone update |
| `src/app/dashboard/settings/page.tsx` (or component) | Modify — add Notification Settings section |
| `.env.example` | Modify — add new env vars |

---

## Out of Scope

- Notification history log
- Per-user opt-out toggles
- Admin manual trigger
- SMS or push notifications
- Renewal-specific reminders (only original `maturityDate` is targeted)
