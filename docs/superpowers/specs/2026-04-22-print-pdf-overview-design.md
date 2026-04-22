# Print PDF Overview — Design Spec

**Date:** 2026-04-22
**Status:** Approved

## Summary

Add a "Print" button to the dashboard overview page that generates a PDF summary of the portfolio and opens it in a new browser tab. The PDF is generated entirely client-side using `@react-pdf/renderer`.

---

## Architecture

### PDF generation library
`@react-pdf/renderer` — declarative React component tree that compiles to PDF. No server round-trip. Generates a `Blob` via `pdf(<Document />).toBlob()`, which is converted to an object URL and opened with `window.open()`.

### Trigger
A `Print PDF` button in the top-right area of the overview page (`src/app/dashboard/overview-client.tsx`). Clicking it calls a `generatePdf(data)` async function, which builds the PDF and opens it in a new tab.

### Data source
The overview page server component (`src/app/dashboard/page.tsx`) already fetches all required data and passes it as props to `OverviewClient`. The `generatePdf` function receives the same props — no additional API calls needed.

### New files
- `src/components/pdf/overview-pdf.tsx` — the `@react-pdf/renderer` document component
- `src/lib/generate-overview-pdf.ts` — thin wrapper that calls `pdf(...).toBlob()` and opens the tab

---

## PDF Layout (A4, white background)

Sections in order, top to bottom:

### 1. Header
- Left: title "Portfolio Summary", date generated, user email
- Right: total portfolio value (large)
- Red (`#ff385c`) bottom border

### 2. Stat cards row (4 columns)
| Card | Value | Sub-label | Accent colour |
|------|-------|-----------|---------------|
| Equity | current value | P&L % | `#ff385c` |
| FD Corpus | total principal | avg interest rate | `#3b82f6` |
| Gold | current value | gain/loss % | `#f59e0b` |
| Portfolio CAGR | % | "annualised" | `#8b5cf6` |

Each card has a left-border accent, grey background (`#f7f7f8`).

### 3. Two-column row
**Left — Asset Allocation**
- Static SVG donut chart (hand-drawn arcs, no Recharts)
- Legend: Equity, FD, Gold, MF with colour swatches and percentages

**Right — Mutual Funds + Upcoming Maturities**
- MF table: Invested / Current Value / P&L
- Upcoming FD maturities list (FDs maturing this calendar month, with days remaining)

### 4. FD Corpus by Bank (full-width)
- Horizontal bar chart: one row per bank
- Each row: bank name | proportional blue bar | amount | percentage of total FD corpus
- Bars are static SVG `<rect>` elements sized proportionally

### 5. Two-column row
**Left — Top Holdings**
- Horizontal bar chart of top equity positions by value
- Static SVG bars, stock names alongside

**Right — FD Interest Accrual (24 months)**
- Static SVG area chart: accrued interest (solid line) vs projected (dashed line)
- X-axis labels: Now / 12m / 24m

### 6. Footer
- Left: "Personal Investment Tracker"
- Right: "Page 1 of 1"
- Top border separator

---

## Static SVG Charts

Since `@react-pdf/renderer` supports SVG natively, all charts are hand-authored SVG — no Recharts. Each chart component:
- Accepts the same data already available in the overview props
- Computes bar widths / arc angles / path coordinates from the data
- Returns an `<Svg>` element from `@react-pdf/renderer`

Chart components live in `src/components/pdf/charts/`:
- `AllocationDonut.tsx`
- `FdByBankBars.tsx`
- `TopHoldingsBars.tsx`
- `FdAccrualArea.tsx`

---

## Button placement

The print button sits in the top-right of `overview-client.tsx`, alongside any existing header controls. It uses an existing shadcn/ui `<Button variant="outline">` with a `Printer` icon from `lucide-react`. While the PDF is generating the button shows a spinner and is disabled to prevent double-clicks.

---

## Error handling

- If PDF generation throws, log the error to the console and re-enable the button. No toast library is present in the app; a simple `console.error` is sufficient since errors here are unlikely (all data is already present client-side).

---

## Out of scope

- 10-Year Wealth Projection chart (explicitly excluded)
- Server-side PDF generation
- PDF download (file save) — opens in new tab only
- Print stylesheet / `window.print()` approach
