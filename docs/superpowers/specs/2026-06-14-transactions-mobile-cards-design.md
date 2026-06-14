# Mobile card layout for the transactions list

**Date:** 2026-06-14
**Status:** Approved
**Component:** `src/app/dashboard/bank-accounts/list/transactions-table.tsx`

## Problem

On small screens the transactions `<table>` hides the **Account** column below `sm`
(640px) and the **Category** column below `md` (768px) via `hidden sm/md:table-cell`.
The result: on a phone the user cannot see a transaction's category at all. Horizontal
table scrolling is awkward on touch.

## Goal

Replace the table with a card layout below `md` (768px) so every transaction's key
fields — including category — are visible and the category remains editable. The
desktop table is unchanged.

## Approach

Keep the existing `<table>` and wrap its container in `hidden md:block`. Add a parallel
card list rendered in a `md:hidden` container that maps over the **same** `rows` state.
Both presentations share the same `fetchRows`, `updateCategory`, `editingCategoryId`,
loading/empty handling, and the (already responsive) filter bar and pagination. No
JS-based breakpoint detection — pure CSS responsive switch, so no hydration flicker.

## Card anatomy (one transaction)

- **Top row:** `displayLabel` (AI `prettyDescription` ?? `prettify` merchant) + method
  chip (`UPI`/`NEFT`/…) on the left; signed amount on the right — red `−₹` for debit,
  green `+₹` for credit. This replaces the separate Debit/Credit columns.
- **FD link chip** (when `r.fd` exists) shown inline, linking to `/dashboard/fd/{id}`,
  same content as the table.
- **Middle row:** `formatDate(txnDate)` · `account.label`, muted and small.
- **Bottom row:** category as a tappable chip. Tapping swaps it for the same inline
  `<select>` used in the table (drives `updateCategory` + the merchant-rule prompt).
  Uncategorized shows an italic "Uncategorized" chip that is still tappable. Running
  balance (`balanceAfter`) right-aligned when non-null; omitted in all-accounts view
  where it is `null` (expected, not a bug).

## States

- **Loading (no rows yet):** a few skeleton cards in the `md:hidden` container.
- **Empty:** same "No transactions match your filters" message + Clear-filters action,
  centered in a card-shaped container.

## Out of scope

No API changes, no new data fields, no change to desktop table markup/behavior, no
swipe gestures, no virtualization.

## Testing

This project has no React component test harness (vitest `environment: "node"`,
`*.test.ts` only, no jsdom/testing-library) — all tests cover pure lib logic. Consistent
with that convention, this presentational change is verified in the browser preview at a
phone viewport (category visible, tap-to-edit works, debit/credit colors correct,
balance shown only in single-account view) rather than via new component tests.
