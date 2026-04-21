# FD Inline Expand — Design

**Date:** 2026-04-21
**Status:** Approved

## Overview

Clicking a row in the Fixed Deposits list currently navigates to a dedicated detail page. This design replaces that navigation with an **inline expandable row** — the full deposit detail appears directly beneath the row, keeping the user in-context.

The separate detail route (`/dashboard/fd/[id]`) is preserved for bookmarks, shared links, and a full-page fallback accessible from an "Open full page" link inside the expanded row.

## Design Principles

The expanded row is the most data-dense surface in the app and will be reviewed by senior stakeholders. It must feel **elegant, simple, and user-friendly**:

- **Restraint over decoration** — borders and whitespace carry structure; avoid filled card backgrounds inside the panel
- **Clear hierarchy** — uppercase micro-labels (10–11 px, letter-spaced) sit quietly above bold monospaced numbers
- **Balance** — two equal columns hold Deposit Details and Renewal & Nominee; Source Document nests under Renewal & Nominee rather than spawning a third column
- **Calm motion** — chevron rotates 90° on open; the expand itself is instantaneous (no height animation) to stay snappy with tall content
- **Quiet actions** — Renew, Delete, and "Open full page" sit behind a subtle divider at the bottom, never competing with the data above

## Goals

- Replace list → detail navigation with an inline, same-page expansion
- Surface the complete deposit record without context-switching
- Preserve the detail route for deep linking
- Keep a single source of truth for the detail layout (no duplication between list-expand and detail page)

## Architecture

### A new shared component: `FDDetailContent`

A new file `src/app/dashboard/fd/fd-detail-content.tsx` exports `<FDDetailContent fd={...} />`. It renders the data-dense body of the deposit view:

1. **Progress block** — start date · rate + interest type + compound frequency · maturity date, with a 4 px progress fill and "X% elapsed · N days remaining" caption
2. **Four summary cards** — Principal, Accrued Interest, Total Interest, Maturity Value (border-only, no filled backgrounds)
3. **Two-column details**
   - Left column: Deposit Details (FD Number, Account Number, Interest Type, Compound Frequency, Tenure, Start Date, Maturity Date, Created)
   - Right column: Renewal & Nominee (Maturity Instruction, Payout Frequency, Nominee, Relation), then Source Document (PDF pill OR image thumbnails) nested below
4. **Notes** — only when non-empty, full width below the two columns
5. **Renewal history** — only when renewals exist; chronological list with "Original" and "R1", "R2", … badges

The component is pure — it accepts a fully-loaded FD (with renewals) and computes all derived values (accrued interest, progress percent, days remaining) at render. No data fetching, no server-only imports. This is a prerequisite: both the list-page expanded row and the detail page must render identical output from identical input.

### A small interactive helper: `CopyButton`

Defined inside `fd-detail-content.tsx` and used twice — next to FD Number and Account Number values.

- 12 px `Copy` icon from lucide-react, muted color `#6e6e73`, brightens to `#ededed` on hover
- Click invokes `navigator.clipboard.writeText(value)` and swaps the icon to `Check` for ~1.5 s before reverting
- `aria-label="Copy FD number"` / `"Copy account number"`; keyboard-focusable
- Hidden when the underlying value is empty

Because `CopyButton` needs click state, it is the only client-interactive piece inside `FDDetailContent`. The rest of the file is declarative JSX.

### FD list page: `fd-list.tsx`

- Adds `expandedIds: Set<string>` component-local state. Multiple rows may be expanded simultaneously (no accordion behavior).
- The existing **Action column** (quick-delete trash icon) is **removed**. A new **Chevron column** (~44 px, right-aligned) takes its place.
- Chevron is a lucide `ChevronRight` icon that rotates 90° via CSS transform when that row's ID is in `expandedIds`.
- Clicking the chevron toggles the ID in the set. The row's own `onClick` navigation handler is removed; the row hover background stays for feedback.
- Each FD now renders as two `<tr>` elements: the data row (unchanged layout) and, conditionally, an expansion row containing `<td colSpan="N">` wrapping `<FDDetailContent />` plus an actions bar (Renew, Delete, "Open full page ↗").
- Expand state is ephemeral — component-local, lost on page reload. No URL hash, no localStorage.

### Detail page: `src/app/dashboard/fd/[id]/page.tsx`

The detail route stays for deep-linking. Its body is trimmed to the pieces that don't make sense inline:

- Back link ("← Back to Fixed Deposits")
- Matured banner and the "Complete renewal history" informational banner
- Header card (bank avatar, name, FD / account numbers, status chip, Renew + Delete buttons)
- Below the header card: `<FDDetailContent fd={fd} />`

`FDDeleteButton` is unchanged and consumed by both the header card (detail page) and the actions bar (expanded row).

## Data Flow

- The list page is a server component that already loads every FD with its renewals (`findMany({ include: { renewals: true } })`). All fields needed by `FDDetailContent` are present on the client-side array — no API or query changes required.
- The detail page continues to do its own `findUnique` (needed for deep-link loads) and passes the result into the shared component.

## Out of Scope

- Animated height transition on expand (deliberate — keeps interactions snappy with variable content height)
- Persisting expand state across navigation or page reload
- Keyboard shortcut to expand/collapse all rows
- Any schema or API changes

## Files

| File | Change |
| --- | --- |
| `src/app/dashboard/fd/fd-detail-content.tsx` | **Create** — shared detail body component + `CopyButton` helper |
| `src/app/dashboard/fd/fd-list.tsx` | **Modify** — add expand state, chevron column, expansion row; remove navigation click and Action column |
| `src/app/dashboard/fd/[id]/page.tsx` | **Modify** — slim detail body to use `<FDDetailContent />` |

No schema migrations. No API changes. No new dependencies.
