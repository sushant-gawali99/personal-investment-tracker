# Add FD Form — Sticky Nav + Sticky Save Redesign

**Date:** 2026-04-22
**Target file:** `src/app/dashboard/fd/new/fd-new-form.tsx`

## Problem

The Add FD form is a single long-scroll page with 5 stacked sections: AI Digitize → (optional Prior Renewals) → FD Details → Renewal & Nominee → Optional Details → Save button at the bottom. Users scroll a lot to reach Save, and there is no indication of where they are in the form or which sections are complete.

## Goal

Reduce scroll friction and make section progress/Save always accessible, without restructuring the fields themselves.

## Non-goals

- No change to form field set, validation rules, submit payload, or API contracts.
- No wizard/multi-step flow — remains a single form.
- No change to AI extract, PDF/image upload, or camera capture behavior.

## Design

### Layout

**Desktop (≥1024px)** — two-column:
- Left sidebar, sticky to viewport (~220px wide): section stepper with status indicators.
- Right main column: form content (max-width unchanged).
- Sticky footer bar at bottom of main column: Cancel + Save Fixed Deposit.

**Mobile (<1024px)** — single column:
- Sticky top bar: horizontal scrollable chips, one per section, each with a status dot.
- Form content below.
- Sticky bottom bar: Save Fixed Deposit (primary). Cancel moves inline above the bottom bar.

### Sections (sidebar / chip order)

1. **Receipt** — the AI Digitize panel. After a successful extraction, it auto-collapses to a slim one-line bar: `AI Extracted ✓ from <filename> — [expand]`. Clicking expand re-opens the full panel. Before extraction (or on error), it is expanded as today.
2. **Prior Periods** — only present when AI detected `renewalNumber > 0`. Renders as a single sidebar/chip entry; scrolling to it places the first prior-period section at the top of the viewport.
3. **FD Details** — core required fields (unchanged).
4. **Renewal & Nominee** — unchanged.
5. **Notes** — replaces the "Optional Details" header. The collapse/expand toggle goes away; the Notes textarea renders inline (it is the only field in that section today).

### Status indicators

Per section, computed from current form state:

- **Empty circle** — section has no filled fields.
- **Filled dot (muted)** — at least one field filled but required fields still missing.
- **Check (accent)** — all required fields for that section are filled.
- **Red dot** — the last submit attempt failed validation for a field in this section. Cleared on the next successful re-validation of that section.

Required-field rules per section:

- **Receipt:** no required fields (AI is optional). Always shows empty circle or check once a file is attached/extracted.
- **Prior Periods:** all prior periods must have `startDate`, `maturityDate`, `principal`, `interestRate`, `tenureMonths` filled. `maturityAmount` is optional.
- **FD Details:** `bankName`, `principal`, `interestRate`, `tenureMonths`, `startDate`, `maturityDate`, `interestType`.
- **Renewal & Nominee:** no required fields.
- **Notes:** no required fields.

### Navigation

- Sidebar entry / chip click: smooth-scroll the corresponding section into view; for Prior Periods, scroll to the first prior period.
- On Save attempt with missing required fields: `preventDefault`, mark offending sections with red dot, smooth-scroll to the first invalid field and focus it.

### Sticky Save footer

- Always visible on both breakpoints.
- Contains: `Cancel` (desktop only in the footer; mobile keeps it inline above), `Save Fixed Deposit` primary button with existing loading state.
- On desktop, `saveError` banner renders above the sticky footer, inside the main column.
- On mobile, `saveError` renders above the sticky bottom bar in the scroll flow.

### Receipt auto-collapse behavior

- State: `receiptCollapsed: boolean`, defaults to `false`.
- Set to `true` when `extracted` becomes `true` (on successful extraction).
- Set to `false` when user clicks the slim bar's expand control or when they clear/replace the uploaded file(s).
- Collapsed bar shows: AI-extracted chip, filename(s), and an expand chevron. No re-extraction is triggered by expanding.

## Components (new / changed)

- `FDNewForm` (existing): refactored to render the new shell (sidebar / top chips / sticky footer) around the existing section JSX. Section JSX is wrapped with stable `id`s and `ref`s so the stepper can scroll/focus.
- `FormStepper` (new, local to `fd-new-form.tsx`): pure presentational; takes `sections: { id, label, status }[]` and an `onSelect(id)` handler. Renders sidebar on desktop (via Tailwind `lg:` classes) and horizontal chips on mobile within the same component.
- `ReceiptPanel` (new, local): wraps the existing AI Digitize JSX and adds the collapsed-bar view. Avoids bloating `FDNewForm` render further.
- Section status derivation: a single `useMemo` in `FDNewForm` that returns `Record<SectionId, Status>` from `form`, `priorRenewals`, `frontFile`/`pdfFile`, `extracted`, and the last-submit invalid-set.

## State additions

- `receiptCollapsed: boolean`
- `invalidSections: Set<SectionId>` — populated on failed submit, cleared entries on successful per-section validation.

## Styling

- Reuse existing `ab-card`, `ab-chip`, `ab-btn`, `ab-input`, `ab-label` classes. No new global CSS.
- Sidebar uses `sticky top-<navOffset>` with the existing card background tokens.
- Sticky footer uses a bottom-anchored container with the same dark border/background as other cards, with a subtle top border to separate from content.

## Accessibility

- Sidebar entries and mobile chips are `<button type="button">` with `aria-current="true"` when their section is in view (via IntersectionObserver; single observer instance shared across sections).
- Status indicator has a `sr-only` label (e.g., "complete", "incomplete", "has errors").
- Sticky footer's primary button keeps its existing semantics; no focus trap.

## Testing / verification

Manual verification via the Claude Preview tools after implementation:

1. Desktop viewport (1280×800): sidebar visible, sticky on scroll, Save footer visible while scrolling through all sections.
2. Mobile viewport (375×800): top chip bar scrollable, sticky Save bar visible.
3. Section status transitions: empty → partial → complete as fields fill.
4. Submit with missing required: red dots appear, first invalid field focused.
5. AI extraction flow: upload → extract → receipt auto-collapses → expand restores full panel.
6. Prior renewals flow: when AI returns `renewalNumber > 0`, the "Prior Periods" entry appears in the stepper.

## Risks / open questions

- IntersectionObserver thresholds need tuning so the "in view" highlight feels natural when sections are short (e.g., Notes).
- Sticky footer on mobile Safari can be finicky with the URL bar; test on-device if possible.
