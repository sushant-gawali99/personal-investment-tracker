# FD Form Sticky Nav + Sticky Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Add FD form shell into a two-column (desktop) / stacked-with-sticky-chips (mobile) layout with an always-visible Save footer, a section stepper showing per-section completion/validation status, and an auto-collapsing AI Receipt panel — without changing any form fields, validation, submit payload, or API calls.

**Architecture:** All changes are confined to `src/app/dashboard/fd/new/fd-new-form.tsx`. We introduce two local components inside that file: `FormStepper` (stepper + chip bar) and render the existing section JSX with stable `id`s and `ref`s so the stepper can scroll / focus. Section completion status is derived in a single `useMemo`. Two new pieces of state — `receiptCollapsed` and `invalidSections` — handle the auto-collapse and failed-submit feedback. No schema, API, or route changes.

**Tech Stack:** Next.js 16 App Router (React client component), Tailwind CSS, lucide-react icons, existing `ab-*` utility classes.

**Spec:** `docs/superpowers/specs/2026-04-22-fd-form-sticky-nav-design.md`

---

## File Map

| Path | Change | Reason |
| --- | --- | --- |
| `src/app/dashboard/fd/new/fd-new-form.tsx` | **Modify** | All UI-shell changes live here: layout, stepper, sticky footer, receipt auto-collapse, invalid-section tracking |

No other files change.

---

## Reference: Section IDs

Use these exact string literals throughout. They are both the DOM `id`s and the `SectionId` union members.

- `"receipt"` — AI Digitize panel
- `"prior"` — Prior Periods wrapper (only rendered when `priorRenewals.length > 0`)
- `"details"` — FD Details
- `"renewal"` — Renewal & Nominee
- `"notes"` — Notes (replaces "Optional Details")

---

## Task 1: Add section type + refs scaffolding

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add the SectionId type and a refs record near the top of `FDNewForm`**

Just under the existing `const [pdfFile, setPdfFile] = useState<File | null>(null);` line (around line 259), add:

```tsx
type SectionId = "receipt" | "prior" | "details" | "renewal" | "notes";

const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
  receipt: null,
  prior: null,
  details: null,
  renewal: null,
  notes: null,
});
```

Also add `useRef` to the existing React import if not already imported. Check line 3 — it currently imports `useState, useCallback, useRef, useEffect`, so `useRef` is already there.

- [ ] **Step 2: Attach `id` and `ref` to each section wrapper**

For each of the 5 sections inside the returned `<form>`, add `id` and `ref` props to the outermost `<section>` tag:

- Receipt panel (currently `<section className="ab-card p-6 space-y-5">` starting around line 450): add `id="receipt"` and `ref={(el) => { sectionRefs.current.receipt = el; }}`.
- Prior renewals (`priorRenewals.map(...)` starting around line 563): wrap the entire `.map` in a single `<section id="prior" ref={(el) => { sectionRefs.current.prior = el; }} className="space-y-6">{priorRenewals.map(...)}</section>` — but only render this wrapper when `priorRenewals.length > 0`.
- FD Details (starting around line 610): add `id="details"` and the matching ref.
- Renewal & Nominee (starting around line 685): add `id="renewal"` and the matching ref.
- Optional Details (starting around line 723): add `id="notes"` and the matching ref. (The content of this section will be restructured in Task 8.)

- [ ] **Step 3: Verify the page still renders**

Start the dev server with `preview_start` (or confirm one is already running via `preview_list`). Navigate to `/dashboard/fd/new`. Open `preview_console_logs` — expect no new errors. Do `preview_snapshot` — expect to see the existing form unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "refactor(fd-form): add section ids and refs scaffolding"
```

---

## Task 2: Derive per-section status

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add `invalidSections` state and a `sectionStatus` memo**

Under the existing `useState` calls in `FDNewForm` (around line 259, after `sectionRefs`), add:

```tsx
const [invalidSections, setInvalidSections] = useState<Set<SectionId>>(new Set());

type SectionStatus = "empty" | "partial" | "complete" | "error";

const sectionStatus = useMemo<Record<SectionId, SectionStatus>>(() => {
  const detailsRequired = [
    form.bankName,
    form.principal,
    form.interestRate,
    form.tenureMonths,
    form.startDate,
    form.maturityDate,
    form.interestType,
  ];
  const detailsFilled = detailsRequired.filter((v) => v && v.trim() !== "").length;

  const priorAllComplete = priorRenewals.every((r) =>
    r.startDate && r.maturityDate && r.principal && r.interestRate && r.tenureMonths
  );
  const priorAnyFilled = priorRenewals.some((r) =>
    r.startDate || r.maturityDate || r.principal || r.interestRate || r.tenureMonths
  );

  const receiptHasFile = !!frontFile || !!pdfFile;
  const renewalAnyFilled = !!(form.maturityInstruction || form.payoutFrequency || form.nomineeName || form.nomineeRelation);
  const notesAnyFilled = !!form.notes;

  const statusFor = (id: SectionId, raw: SectionStatus): SectionStatus =>
    invalidSections.has(id) ? "error" : raw;

  return {
    receipt: statusFor("receipt", receiptHasFile ? (extracted ? "complete" : "partial") : "empty"),
    prior: statusFor("prior", priorRenewals.length === 0 ? "empty" : priorAllComplete ? "complete" : priorAnyFilled ? "partial" : "empty"),
    details: statusFor(
      "details",
      detailsFilled === detailsRequired.length ? "complete" : detailsFilled === 0 ? "empty" : "partial"
    ),
    renewal: statusFor("renewal", renewalAnyFilled ? "complete" : "empty"),
    notes: statusFor("notes", notesAnyFilled ? "complete" : "empty"),
  };
}, [form, priorRenewals, frontFile, pdfFile, extracted, invalidSections]);
```

Also add `useMemo` to the React import at line 3: change `import { useState, useCallback, useRef, useEffect } from "react";` to `import { useState, useCallback, useRef, useEffect, useMemo } from "react";`.

- [ ] **Step 2: Verify no TypeScript errors**

Run `npm run build` — expect it to compile. (If the project has a faster type-check, use it, but the existing plans in `docs/superpowers/plans/` rely on `npm run build`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): derive per-section completion status"
```

---

## Task 3: Add the `FormStepper` local component

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add the component definition**

Just above the `FDNewForm` export (around line 235), add:

```tsx
type StepperItem = { id: SectionId; label: string; status: SectionStatus };

function StepperDot({ status }: { status: SectionStatus }) {
  const srLabel =
    status === "complete" ? "complete"
    : status === "error" ? "has errors"
    : status === "partial" ? "in progress"
    : "empty";

  const base = "w-4 h-4 rounded-full flex items-center justify-center shrink-0";
  if (status === "complete") {
    return (
      <span className={cn(base, "bg-[#ff385c] text-white")} aria-hidden>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="sr-only">{srLabel}</span>
      </span>
    );
  }
  if (status === "error") {
    return <span className={cn(base, "bg-[#ff7a6e]")} aria-label={srLabel} />;
  }
  if (status === "partial") {
    return <span className={cn(base, "bg-[#a0a0a5]")} aria-label={srLabel} />;
  }
  return <span className={cn(base, "border border-[#3a3a3f]")} aria-label={srLabel} />;
}

function FormStepper({
  items, activeId, onSelect,
}: {
  items: StepperItem[];
  activeId: SectionId | null;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <>
      {/* Desktop: vertical sticky sidebar */}
      <aside className="hidden lg:block w-[220px] shrink-0">
        <div className="sticky top-6 ab-card p-3 space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={activeId === it.id ? "true" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-[13px] transition-colors",
                activeId === it.id
                  ? "bg-[#1c1c20] text-[#ededed]"
                  : "text-[#a0a0a5] hover:bg-[#17171a] hover:text-[#ededed]"
              )}
            >
              <StepperDot status={it.status} />
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile: sticky horizontal chip bar */}
      <div className="lg:hidden sticky top-0 z-30 -mx-4 px-4 py-2 bg-[#0e0e10]/95 backdrop-blur border-b border-[#2a2a2e]">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={activeId === it.id ? "true" : undefined}
              className={cn(
                "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors",
                activeId === it.id
                  ? "bg-[#1c1c20] border-[#3a3a3f] text-[#ededed]"
                  : "bg-[#17171a] border-[#2a2a2e] text-[#a0a0a5]"
              )}
            >
              <StepperDot status={it.status} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
```

Note: `no-scrollbar` — if this utility is not present, fall back to `style={{ scrollbarWidth: "none" }}` on the inner flex div. Check `src/app/globals.css` for a `.no-scrollbar` rule; if absent, use the inline style instead.

- [ ] **Step 2: Verify compile**

Run `npm run build` — expect success.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): add FormStepper component"
```

---

## Task 4: Wire the stepper into the form layout

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add the `activeId` state and scroll handler inside `FDNewForm`**

Under the existing state declarations (after `invalidSections`), add:

```tsx
const [activeId, setActiveId] = useState<SectionId | null>("receipt");

function scrollToSection(id: SectionId) {
  const el = sectionRefs.current[id];
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
```

- [ ] **Step 2: Add an IntersectionObserver to track the active section**

Add this `useEffect` just after the handlers above:

```tsx
useEffect(() => {
  const entries = (Object.keys(sectionRefs.current) as SectionId[])
    .map((id) => ({ id, el: sectionRefs.current[id] }))
    .filter((e): e is { id: SectionId; el: HTMLElement } => !!e.el);

  if (entries.length === 0) return;

  const observer = new IntersectionObserver(
    (obs) => {
      const visible = obs
        .filter((o) => o.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) {
        const match = entries.find((e) => e.el === visible[0].target);
        if (match) setActiveId(match.id);
      }
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  entries.forEach((e) => observer.observe(e.el));
  return () => observer.disconnect();
}, [priorRenewals.length]); // re-observe when prior section appears/disappears
```

- [ ] **Step 3: Restructure the outer `<form>` JSX to two columns**

Replace the current root element:

```tsx
<form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
```

with:

```tsx
<form onSubmit={handleSubmit} className="max-w-6xl mx-auto lg:flex lg:gap-6 lg:items-start pb-24">
```

Just inside the `<form>`, before the renewedFrom banner, insert the stepper:

```tsx
<FormStepper
  items={[
    { id: "receipt", label: "Receipt", status: sectionStatus.receipt },
    ...(priorRenewals.length > 0 ? [{ id: "prior" as SectionId, label: "Prior Periods", status: sectionStatus.prior }] : []),
    { id: "details", label: "FD Details", status: sectionStatus.details },
    { id: "renewal", label: "Renewal & Nominee", status: sectionStatus.renewal },
    { id: "notes", label: "Notes", status: sectionStatus.notes },
  ]}
  activeId={activeId}
  onSelect={scrollToSection}
/>
```

Wrap the existing content (renewedFrom banner through the final buttons row) in a `<div className="flex-1 min-w-0 space-y-6">`. The Cancel / Save buttons at the end move to a sticky footer in Task 5.

The final structure should look like:

```tsx
<form onSubmit={handleSubmit} className="max-w-6xl mx-auto lg:flex lg:gap-6 lg:items-start pb-24">
  <FormStepper items={...} activeId={activeId} onSelect={scrollToSection} />
  <div className="flex-1 min-w-0 space-y-6">
    {renewedFrom && (...)}
    {/* receipt section */}
    {/* prior wrapper */}
    {/* details section */}
    {/* renewal section */}
    {/* notes section */}
    {saveError && (...)}
    {/* Cancel/Save buttons — moved in Task 5 */}
  </div>
</form>
```

- [ ] **Step 4: Manual verify in preview**

Ensure dev server is running (`preview_start` if needed). Navigate to `/dashboard/fd/new`. Use `preview_resize` to switch between 1280×800 (desktop) and 375×800 (mobile):

- Desktop: sidebar shows on the left, sticks when scrolling, and the active section highlights as you scroll.
- Mobile: horizontal chip bar shows at the top, scrolls horizontally, sticks when scrolling the page.

Use `preview_click` on a sidebar entry — expect smooth-scroll to that section. Check `preview_console_logs` for errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): add section stepper + active tracking"
```

---

## Task 5: Add the sticky Save footer

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Replace the inline buttons row with a sticky footer**

Find the current buttons block at the bottom of the form (around line 751):

```tsx
<div className="flex items-center justify-end gap-3 pt-2">
  <button type="button" onClick={() => router.back()} className="ab-btn ab-btn-ghost">Cancel</button>
  <button type="submit" disabled={saving} className="ab-btn ab-btn-accent">
    {saving ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : "Save Fixed Deposit"}
  </button>
</div>
```

Remove this block from inside the form column, and instead add — as the LAST child of the `<form>` (after the `</div>` that closes the `flex-1` column) — a sticky footer:

```tsx
<div className="fixed bottom-0 inset-x-0 z-30 bg-[#0e0e10]/95 backdrop-blur border-t border-[#2a2a2e]">
  <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-end gap-3">
    <button
      type="button"
      onClick={() => router.back()}
      className="ab-btn ab-btn-ghost"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={saving}
      className="ab-btn ab-btn-accent"
    >
      {saving ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : "Save Fixed Deposit"}
    </button>
  </div>
</div>
```

Note: the `pb-24` already added to the form root in Task 4 reserves vertical room under the last section so content is not hidden behind the sticky footer.

- [ ] **Step 2: Manual verify**

Preview at desktop and mobile widths. Scroll the form; Save button stays anchored to the bottom of the viewport. `preview_screenshot` to confirm.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): sticky Save footer"
```

---

## Task 6: Receipt auto-collapse

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add the `receiptCollapsed` state and auto-collapse effect**

Under the existing `useState` calls in `FDNewForm` (near the other state), add:

```tsx
const [receiptCollapsed, setReceiptCollapsed] = useState(false);

useEffect(() => {
  if (extracted) setReceiptCollapsed(true);
}, [extracted]);
```

Also update `clearFront`, `clearBack`, and `clearPdf` to re-expand:

```tsx
function clearFront() { setFrontFile(null); setFrontPreview(null); setExtracted(false); setReceiptCollapsed(false); }
function clearBack() { setBackFile(null); setBackPreview(null); }
function clearPdf() { setPdfFile(null); setExtracted(false); setReceiptCollapsed(false); }
```

Also update the image/PDF mode toggle handler (inside the `<button>` onClick around line 467) — in its body, add `setReceiptCollapsed(false);` after `setExtractError("");`.

- [ ] **Step 2: Render the collapsed bar when `receiptCollapsed` is true**

Replace the existing receipt `<section id="receipt" ...>` content with a conditional:

```tsx
<section
  id="receipt"
  ref={(el) => { sectionRefs.current.receipt = el; }}
  className={cn(receiptCollapsed ? "ab-card-flat" : "ab-card p-6 space-y-5")}
>
  {receiptCollapsed ? (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="ab-chip ab-chip-accent shrink-0">
          <Sparkles size={12} /> AI Extracted
        </span>
        <span className="text-[13px] text-[#a0a0a5] truncate">
          from {uploadMode === "pdf" ? (pdfFile?.name ?? "receipt.pdf") : (frontFile?.name ?? "receipt")}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setReceiptCollapsed(false)}
        className="ab-btn ab-btn-ghost shrink-0"
        style={{ fontSize: "13px" }}
      >
        <ChevronDown size={14} /> Expand
      </button>
    </div>
  ) : (
    <>
      {/* ... existing AI Digitize panel body: header, mode toggle, dropzones, Extract button, errors, success pill ... */}
    </>
  )}
</section>
```

Move the existing content (the `<div className="flex items-start gap-3">` header block through the `extracted && renewalNumber > 0` bottom banner) into the `<>...</>` branch. Leave it unchanged otherwise.

- [ ] **Step 3: Manual verify**

In preview:
1. Upload an FD image and click "Extract with AI" (or use an FD fixture if available). After success, the panel collapses to the slim bar.
2. Click "Expand" — the full panel re-opens.
3. Switch between Image/PDF mode — expands and resets state.
4. Click the Remove button on an uploaded image — panel expands.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): auto-collapse receipt after AI extract"
```

---

## Task 7: Validation feedback on submit

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Compute missing-required sections before submitting**

At the top of `handleSubmit`, before `setSaveError("")`, add:

```tsx
const missing = new Set<SectionId>();

const detailsMissing =
  !form.bankName || !form.principal || !form.interestRate ||
  !form.tenureMonths || !form.startDate || !form.maturityDate || !form.interestType;
if (detailsMissing) missing.add("details");

const priorMissing = priorRenewals.some(
  (r) => !r.startDate || !r.maturityDate || !r.principal || !r.interestRate || !r.tenureMonths
);
if (priorRenewals.length > 0 && priorMissing) missing.add("prior");

if (missing.size > 0) {
  e.preventDefault();
  setInvalidSections(missing);
  const firstId: SectionId = missing.has("prior") ? "prior" : "details";
  const sectionEl = sectionRefs.current[firstId];
  if (sectionEl) {
    const firstInvalid = sectionEl.querySelector<HTMLInputElement | HTMLSelectElement>(
      "input:invalid, select:invalid, input[required]:placeholder-shown"
    );
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
    } else {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  return;
}

// clear any stale invalid marks
if (invalidSections.size > 0) setInvalidSections(new Set());
```

Note: because the existing inputs use the native `required` attribute, the browser will normally block submit before our handler runs. To make this custom flow run reliably, add `noValidate` to the `<form>` element:

Change:

```tsx
<form onSubmit={handleSubmit} className="max-w-6xl mx-auto lg:flex lg:gap-6 lg:items-start pb-24">
```

to:

```tsx
<form noValidate onSubmit={handleSubmit} className="max-w-6xl mx-auto lg:flex lg:gap-6 lg:items-start pb-24">
```

This preserves the existing `required` attributes for a11y while letting our handler control validation feedback.

- [ ] **Step 2: Manual verify**

In preview:
1. Open the new form, do nothing, click Save — expect the FD Details sidebar entry to show a red dot, page scrolls to and focuses the Bank Name input. Use `preview_inspect` on the sidebar FD Details button to confirm the dot background color.
2. Fill Bank Name only, click Save — red dot stays, focus moves to next empty required field (Principal).
3. Fill all required, click Save — form submits normally and navigates away.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): mark invalid sections + scroll-to-invalid on submit"
```

---

## Task 8: Flatten Optional Details into Notes

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Remove the collapse toggle and render Notes inline**

Replace the entire Optional Details section (the `<section className="ab-card-flat overflow-hidden">` block around line 723):

```tsx
<section className="ab-card-flat overflow-hidden">
  <button type="button" onClick={() => setShowOptional((s) => !s)} ...>
    <span>Optional Details</span>
    {showOptional ? <ChevronUp size={16} .../> : <ChevronDown size={16} .../>}
  </button>
  {showOptional && (
    <div className="px-6 pb-6 border-t border-[#2a2a2e] pt-5">
      <div>
        <label htmlFor="notes" className="ab-label">Notes</label>
        <textarea id="notes" rows={3} className="ab-input resize-none" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes..." />
      </div>
    </div>
  )}
</section>
```

with:

```tsx
<section
  id="notes"
  ref={(el) => { sectionRefs.current.notes = el; }}
  className="ab-card p-6 space-y-4"
>
  <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Notes</p>
  <div>
    <label htmlFor="notes" className="ab-label">Notes</label>
    <textarea
      id="notes"
      rows={3}
      className="ab-input resize-none"
      value={form.notes}
      onChange={(e) => set("notes", e.target.value)}
      placeholder="Any additional notes..."
    />
  </div>
</section>
```

- [ ] **Step 2: Remove the now-unused `showOptional` state**

Delete the `const [showOptional, setShowOptional] = useState(false);` declaration (around line 255).

- [ ] **Step 3: Remove unused imports**

If `ChevronUp` is no longer referenced anywhere else in the file, remove it from the lucide-react import on line 6. (Keep `ChevronDown` — it is still used by the receipt collapsed-bar expand button.) Verify with a search through the file before removing.

- [ ] **Step 4: Verify compile**

Run `npm run build` — expect success.

- [ ] **Step 5: Manual verify**

In preview, the Notes section shows inline with no collapse toggle, and the sidebar/chip bar includes a "Notes" entry.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat(fd-form): flatten optional details into Notes section"
```

---

## Task 9: End-to-end manual verification

**Files:** none

- [ ] **Step 1: Full golden-path walkthrough**

With the dev server running, at `/dashboard/fd/new`:

1. Desktop 1280×800 (`preview_resize`):
   - Sidebar visible, sticks on scroll.
   - Click each sidebar entry — scrolls to matching section; active highlight follows scroll.
   - Fill all required fields — FD Details entry gets a check.
   - Save footer stays visible throughout.
2. Mobile 375×800 (`preview_resize`):
   - Chip bar sticks to top on scroll.
   - Sticky Save bar visible at bottom.
3. AI flow: upload an FD image, click Extract. Receipt collapses to slim bar. Expand button restores full panel.
4. Validation: with empty form, click Save. Red dot on FD Details. Focus on Bank Name.
5. `preview_screenshot` of the desktop view at the top of the form. `preview_screenshot` of the mobile view at the top.

- [ ] **Step 2: Regression checks**

Run `npm run build` — expect clean build. Open the existing FD list (`/dashboard/fd`) and an existing FD detail page — confirm nothing else regressed.

- [ ] **Step 3: No further commits if prior tasks committed cleanly**

If any issues surfaced during verification, fix inline and commit with an appropriate message. Otherwise the branch is ready.

---

## Self-Review Notes

Spec coverage:
- Two-column desktop / stacked mobile layout → Task 4
- Sticky footer → Task 5
- Section stepper with status indicators → Tasks 2, 3, 4
- Receipt auto-collapse → Task 6
- Invalid-section red dots + scroll-to-first-invalid → Task 7
- Flatten Optional Details to Notes → Task 8
- a11y (aria-current, sr-only status) → Task 3
- IntersectionObserver for active section → Task 4 Step 2
- No schema/API/payload changes → enforced by file map (only one file modified)
