# FD Bank Statement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user upload a bank PDF statement, extract FD-related transactions (interest, maturity, premature close, transfers, TDS), match them to existing FDs, persist them, and show them inside each FD's expanded detail area.

**Architecture:** New vertical slice. Prisma gets `FDStatement` + `FDStatementTxn`. A `src/lib/fd-statement/` library owns parsing (regex-first, Haiku fallback) + classification + matching as pure, testable functions. New API routes under `/api/fd/statements/*`. New UI at `/dashboard/fd/statements` (list + upload/review flow). `fd-detail-content.tsx` gains an "Interest & Transactions" section.

**Tech Stack:** Next.js 16 (app router, breaking changes from stable — read `node_modules/next/dist/docs/` when in doubt), Prisma 7, libSQL, `@anthropic-ai/sdk` (Haiku 4.5), `pdf-parse` (new dep), existing `react-dropzone`, shadcn/Base UI.

**Spec:** `docs/superpowers/specs/2026-04-22-fd-bank-statement-import-design.md`

---

## File Structure

**Create**
- `src/lib/fd-statement/types.ts` — shared types (`ParsedTxn`, `TxnType`, `MatchResult`).
- `src/lib/fd-statement/classify.ts` — pure row → `{type, detectedFdNumber}`.
- `src/lib/fd-statement/classify.test.ts`
- `src/lib/fd-statement/match.ts` — pure `detectedFdNumber` → `fdId` or ambiguous/null.
- `src/lib/fd-statement/match.test.ts`
- `src/lib/fd-statement/regex-parser.ts` — text → `ParsedTxn[]`.
- `src/lib/fd-statement/regex-parser.test.ts`
- `src/lib/fd-statement/ai-parser.ts` — Haiku fallback; PDF bytes → `ParsedTxn[]`.
- `src/lib/fd-statement/parse-pdf.ts` — orchestrator: extract text → regex → fallback.
- `src/app/api/fd/statements/parse/route.ts` — POST multipart PDF, return parsed + matches.
- `src/app/api/fd/statements/route.ts` — POST (save) + GET (list).
- `src/app/api/fd/statements/[id]/route.ts` — GET detail, DELETE.
- `src/app/api/fd/statements/[id]/pdf/route.ts` — GET source PDF (redirect).
- `src/app/dashboard/fd/statements/page.tsx` — list page.
- `src/app/dashboard/fd/statements/statements-list.tsx` — client component for list + delete.
- `src/app/dashboard/fd/statements/new/page.tsx` — upload/review wizard route.
- `src/app/dashboard/fd/statements/new/statement-upload-form.tsx` — 3-step client wizard.
- `src/app/dashboard/fd/statements/[id]/page.tsx` — statement detail.
- `src/app/dashboard/fd/statements/fd-txn-section.tsx` — "Interest & Transactions" block (used by fd-detail).
- `vitest.config.ts` — **only if** tests aren't already configured (see Task 0).

**Modify**
- `prisma/schema.prisma` — add models + back-relation.
- `package.json` — add `pdf-parse` + `vitest` if needed.
- `src/app/dashboard/fd/fd-detail-content.tsx` — embed `<FdTxnSection />`.
- `src/app/dashboard/fd/page.tsx` or `fd-list.tsx` — add "Statements" link in header.

---

## Task 0: Confirm test runner

**Files:** inspect only.

- [ ] **Step 1: Check if a test runner is configured**

Run: `grep -E '"(test|vitest|jest)"' package.json`
If nothing is configured, proceed with Step 2. Otherwise skip to Task 1 and use the existing runner command in place of `pnpm vitest` references below.

- [ ] **Step 2: Install vitest**

Run: `npm install -D vitest @vitejs/plugin-react`

- [ ] **Step 3: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: Add npm script**

In `package.json` `"scripts"`: add `"test": "vitest run"`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 1: Prisma schema — FDStatement + FDStatementTxn

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two models + back-relation on FixedDeposit**

Append to `prisma/schema.prisma`:

```prisma
model FDStatement {
  id            String   @id @default(cuid())
  userId        String
  bankName      String
  fileName      String
  sourcePdfUrl  String
  fromDate      DateTime?
  toDate        DateTime?
  txnCount      Int      @default(0)
  matchedCount  Int      @default(0)
  parseMethod   String
  uploadedAt    DateTime @default(now())
  transactions  FDStatementTxn[]
  @@index([userId, bankName])
}

model FDStatementTxn {
  id               String   @id @default(cuid())
  statementId      String
  statement        FDStatement   @relation(fields: [statementId], references: [id], onDelete: Cascade)
  fdId             String?
  fd               FixedDeposit? @relation(fields: [fdId], references: [id], onDelete: SetNull)
  txnDate          DateTime
  particulars      String
  debit            Float    @default(0)
  credit           Float    @default(0)
  type             String
  detectedFdNumber String?
  @@index([fdId, txnDate])
  @@index([statementId])
  @@unique([statementId, txnDate, particulars, debit, credit])
}
```

Inside `model FixedDeposit { ... }` add:

```prisma
  statementTxns   FDStatementTxn[]
```

- [ ] **Step 2: Generate + migrate**

Run: `npx prisma generate && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(fd): schema for statement imports"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/fd-statement/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type TxnType =
  | "interest"
  | "maturity"
  | "premature_close"
  | "transfer_in"
  | "transfer_out"
  | "tds"
  | "other";

export interface ParsedTxn {
  txnDate: string; // ISO yyyy-mm-dd
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
}

export interface MatchCandidate {
  fdId: string;
  fdNumber: string | null;
  accountNumber: string | null;
  label: string;
  maturityDate: string; // ISO
}

export type MatchResult =
  | { kind: "matched"; fdId: string }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "none" };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fd-statement/types.ts
git commit -m "feat(fd-statement): shared types"
```

---

## Task 3: classify.ts (TDD)

**Files:**
- Create: `src/lib/fd-statement/classify.ts`
- Test: `src/lib/fd-statement/classify.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { classifyRow } from "./classify";

describe("classifyRow", () => {
  it("classifies interest from 'Int. FD-999030244019507'", () => {
    expect(classifyRow("Int. FD-999030244019507")).toEqual({
      type: "interest",
      detectedFdNumber: "999030244019507",
    });
  });
  it("classifies interest from 'FD NO 16984 MAT INT'", () => {
    expect(classifyRow("FD NO 16984 MAT INT")).toEqual({
      type: "interest",
      detectedFdNumber: "16984",
    });
  });
  it("classifies maturity 'MAT FD 18883 CLSD'", () => {
    expect(classifyRow("MAT FD 18883 CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "18883",
    });
  });
  it("classifies maturity 'FD 11713 MAT AND CLSD'", () => {
    expect(classifyRow("FD 11713 MAT AND CLSD")).toEqual({
      type: "maturity",
      detectedFdNumber: "11713",
    });
  });
  it("classifies premature from 'FD 999 PREMAT CLSD'", () => {
    expect(classifyRow("FD 999 PREMAT CLSD")).toEqual({
      type: "premature_close",
      detectedFdNumber: "999",
    });
  });
  it("classifies transfer_out 'TR TO FD 999030244024577'", () => {
    expect(classifyRow("TR TO FD 999030244024577")).toEqual({
      type: "transfer_out",
      detectedFdNumber: "999030244024577",
    });
  });
  it("classifies transfer_in 'Transfer fr FD-999030244023539'", () => {
    expect(classifyRow("Transfer fr FD-999030244023539")).toEqual({
      type: "transfer_in",
      detectedFdNumber: "999030244023539",
    });
  });
  it("classifies tds 'TDS Deducted-SB-DENGLE RAVINDRA'", () => {
    expect(classifyRow("TDS Deducted-SB-DENGLE RAVINDRA")).toEqual({
      type: "tds",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'Interest Post' without FD number", () => {
    expect(classifyRow("Interest Post")).toEqual({
      type: "other",
      detectedFdNumber: null,
    });
  });
  it("classifies other 'To RD 999020244000802'", () => {
    const r = classifyRow("To RD 999020244000802");
    expect(r.type).toBe("other");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- classify`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement classifyRow**

```ts
import type { TxnType } from "./types";

const FD_NUM_RE = /FD[-\s]?(?:NO\s+)?(\d{3,})/i;

export function classifyRow(particulars: string): { type: TxnType; detectedFdNumber: string | null } {
  const p = particulars.trim();
  const upper = p.toUpperCase();
  const fdMatch = p.match(FD_NUM_RE);
  const detectedFdNumber = fdMatch ? fdMatch[1] : null;

  if (/TDS/.test(upper)) return { type: "tds", detectedFdNumber: null };

  if (/PREMAT|PRECLOSE|PREMATURE/.test(upper) && detectedFdNumber) {
    return { type: "premature_close", detectedFdNumber };
  }
  if (/TR\s+TO\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_out", detectedFdNumber };
  }
  if (/TRANSFER\s+FR\s+FD|TRANSFER\s+FROM\s+FD/.test(upper) && detectedFdNumber) {
    return { type: "transfer_in", detectedFdNumber };
  }
  if (/\bINT\b|INTEREST/.test(upper) && detectedFdNumber) {
    return { type: "interest", detectedFdNumber };
  }
  if (/\bMAT\b/.test(upper) && /CLSD|CLOSED/.test(upper) && detectedFdNumber) {
    return { type: "maturity", detectedFdNumber };
  }
  return { type: "other", detectedFdNumber };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- classify`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fd-statement/classify.ts src/lib/fd-statement/classify.test.ts
git commit -m "feat(fd-statement): row classifier with FD number extraction"
```

---

## Task 4: match.ts (TDD)

**Files:**
- Create: `src/lib/fd-statement/match.ts`
- Test: `src/lib/fd-statement/match.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { matchFd } from "./match";
import type { MatchCandidate } from "./types";

const fds: MatchCandidate[] = [
  { fdId: "a", fdNumber: "999030244019507", accountNumber: null, label: "FD A", maturityDate: "2026-12-01" },
  { fdId: "b", fdNumber: "999030244018883", accountNumber: null, label: "FD B", maturityDate: "2026-12-01" },
  { fdId: "c", fdNumber: "16984", accountNumber: null, label: "FD C", maturityDate: "2026-12-01" },
  { fdId: "d", fdNumber: null, accountNumber: "FD-13582", label: "FD D", maturityDate: "2026-12-01" },
];

describe("matchFd", () => {
  it("exact match on fdNumber", () => {
    expect(matchFd("999030244019507", fds)).toEqual({ kind: "matched", fdId: "a" });
  });
  it("exact match on accountNumber (ignoring prefix)", () => {
    expect(matchFd("FD-13582", fds)).toEqual({ kind: "matched", fdId: "d" });
  });
  it("suffix fallback: short detected suffix of stored fdNumber", () => {
    expect(matchFd("18883", fds)).toEqual({ kind: "matched", fdId: "b" });
  });
  it("suffix fallback: stored short fdNumber is suffix of detected long", () => {
    expect(matchFd("999930016984", fds)).toEqual({ kind: "matched", fdId: "c" });
  });
  it("none when no candidates", () => {
    expect(matchFd("11111", fds)).toEqual({ kind: "none" });
  });
  it("ambiguous when multiple suffixes match", () => {
    const ambig: MatchCandidate[] = [
      { fdId: "x", fdNumber: "123999", accountNumber: null, label: "X", maturityDate: "2026-01-01" },
      { fdId: "y", fdNumber: "456999", accountNumber: null, label: "Y", maturityDate: "2026-01-01" },
    ];
    expect(matchFd("999", ambig)).toEqual({ kind: "ambiguous", candidates: ["x", "y"] });
  });
  it("returns none when detected is null", () => {
    expect(matchFd(null, fds)).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npm test -- match`

- [ ] **Step 3: Implement matchFd**

```ts
import type { MatchCandidate, MatchResult } from "./types";

export function matchFd(detected: string | null, fds: MatchCandidate[]): MatchResult {
  if (!detected) return { kind: "none" };
  const d = detected.replace(/^FD[-\s]?/i, "");
  const exact = fds.filter((f) => f.fdNumber === d || f.accountNumber === d || f.accountNumber === detected);
  if (exact.length === 1) return { kind: "matched", fdId: exact[0].fdId };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact.map((f) => f.fdId) };

  const suffix = fds.filter((f) => {
    if (!f.fdNumber) return false;
    return f.fdNumber.endsWith(d) || d.endsWith(f.fdNumber);
  });
  if (suffix.length === 1) return { kind: "matched", fdId: suffix[0].fdId };
  if (suffix.length > 1) return { kind: "ambiguous", candidates: suffix.map((f) => f.fdId) };
  return { kind: "none" };
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test -- match`

- [ ] **Step 5: Commit**

```bash
git add src/lib/fd-statement/match.ts src/lib/fd-statement/match.test.ts
git commit -m "feat(fd-statement): exact + suffix FD matcher"
```

---

## Task 5: regex-parser.ts (TDD)

**Files:**
- Create: `src/lib/fd-statement/regex-parser.ts`
- Test: `src/lib/fd-statement/regex-parser.test.ts`

The parser accepts raw text (output of pdf-parse), finds rows shaped like `DD-Mon-YYYY <particulars> <Tr/Ca> <debit> <credit> <balance>`, and returns `ParsedTxn[]`. Multi-line rows (where the date is on its own line and particulars wrap) are coalesced.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseStatementText } from "./regex-parser";

const SAMPLE = `
TRN-DATE TRN-PARTICULARS CA/TR DEBIT CREDIT BALANCE
01-Jul-2024 Int. FD-999030244019507 Tr 0.00 4121.00 44761.00
05-Apr-2024 To RD 9990244000802 Tr 5500.00 0.00 68140.00
24-Mar-2025 MAT FD 18883 CLSD Tr 0.00 200000.00 219268.00
31-Mar-2026 TDS Deducted-SB-DENGLE RAVINDRA DIWAKAR Tr 1464.00 0.00 65330.00
`;

describe("parseStatementText", () => {
  it("extracts rows with date + particulars + amounts", () => {
    const rows = parseStatementText(SAMPLE);
    expect(rows.length).toBe(4);
    expect(rows[0]).toMatchObject({
      txnDate: "2024-07-01",
      debit: 0,
      credit: 4121,
      type: "interest",
      detectedFdNumber: "999030244019507",
    });
    expect(rows[2]).toMatchObject({ type: "maturity", credit: 200000 });
    expect(rows[3]).toMatchObject({ type: "tds", debit: 1464 });
  });

  it("handles split-line dates like '07-\\nMay-2024'", () => {
    const text = `07-\nMay-2024 Int. FD-999030244019507 Tr 0.00 100.00 1000.00`;
    const rows = parseStatementText(text);
    expect(rows.length).toBe(1);
    expect(rows[0].txnDate).toBe("2024-05-07");
  });

  it("returns empty array for empty text", () => {
    expect(parseStatementText("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npm test -- regex-parser`

- [ ] **Step 3: Implement parseStatementText**

```ts
import type { ParsedTxn } from "./types";
import { classifyRow } from "./classify";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const ROW_RE =
  /(\d{2})-([A-Za-z]{3})-(\d{4})\s+(.+?)\s+(?:Tr|Ca)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+[\d,]+\.\d{2}/g;

function toIso(dd: string, mon: string, yyyy: string): string {
  const mm = MONTHS[mon.toLowerCase().slice(0, 3)];
  if (!mm) return "";
  return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
}

function num(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

export function parseStatementText(text: string): ParsedTxn[] {
  // Collapse whitespace and linebreaks inside the date pattern + rows.
  const flat = text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ");
  const out: ParsedTxn[] = [];
  for (const m of flat.matchAll(ROW_RE)) {
    const [, dd, mon, yyyy, particulars, debitStr, creditStr] = m;
    const iso = toIso(dd, mon, yyyy);
    if (!iso) continue;
    const { type, detectedFdNumber } = classifyRow(particulars);
    out.push({
      txnDate: iso,
      particulars: particulars.trim(),
      debit: num(debitStr),
      credit: num(creditStr),
      type,
      detectedFdNumber,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test -- regex-parser`

- [ ] **Step 5: Commit**

```bash
git add src/lib/fd-statement/regex-parser.ts src/lib/fd-statement/regex-parser.test.ts
git commit -m "feat(fd-statement): regex parser for tabular statements"
```

---

## Task 6: Install pdf-parse + parse-pdf.ts orchestrator

**Files:**
- Modify: `package.json`
- Create: `src/lib/fd-statement/parse-pdf.ts`

- [ ] **Step 1: Install dep**

Run: `npm install pdf-parse && npm install -D @types/pdf-parse`

- [ ] **Step 2: Write the orchestrator**

Create `src/lib/fd-statement/parse-pdf.ts`:

```ts
import type { ParsedTxn } from "./types";
import { parseStatementText } from "./regex-parser";
import { parseWithAI } from "./ai-parser";

export interface ParseOutput {
  txns: ParsedTxn[];
  parseMethod: "regex" | "ai";
}

export async function parseStatementPdf(pdfBytes: Buffer): Promise<ParseOutput> {
  // pdf-parse is CJS; import dynamically to avoid Next bundler issues.
  const { default: pdfParse } = await import("pdf-parse");
  const { text } = await pdfParse(pdfBytes);
  const regexTxns = parseStatementText(text);
  if (regexTxns.length > 0) return { txns: regexTxns, parseMethod: "regex" };
  const aiTxns = await parseWithAI(pdfBytes);
  return { txns: aiTxns, parseMethod: "ai" };
}
```

- [ ] **Step 3: Commit (ai-parser stub comes next)**

Defer commit until ai-parser exists (Task 7). Proceed to Task 7.

---

## Task 7: ai-parser.ts (Haiku fallback)

**Files:**
- Create: `src/lib/fd-statement/ai-parser.ts`

- [ ] **Step 1: Implement the AI parser**

```ts
import { anthropic } from "@/lib/anthropic";
import type { ParsedTxn } from "./types";
import { classifyRow } from "./classify";

const PROMPT = `Extract every transaction row from this bank statement PDF. Return ONLY a JSON array (no prose). Each element:

{ "txnDate": "YYYY-MM-DD", "particulars": string, "debit": number, "credit": number }

Rules:
- txnDate: the transaction date, not the run/print date.
- particulars: the full "TRN-PARTICULARS" text as printed. Preserve FD numbers, account numbers, and keywords verbatim.
- debit / credit: numbers, 0 if blank. No commas.
- Include EVERY row, even "To RD...", "Interest Post", "TDS Deducted...".
- Do not include the opening balance line or totals.`;

type AiRow = { txnDate: string; particulars: string; debit: number; credit: number };

export async function parseWithAI(pdfBytes: Buffer): Promise<ParsedTxn[]> {
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBytes.toString("base64") } } as never,
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  const json = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  let rows: AiRow[];
  try {
    rows = JSON.parse(json);
  } catch {
    return [];
  }
  return rows.map((r) => {
    const { type, detectedFdNumber } = classifyRow(r.particulars);
    return {
      txnDate: r.txnDate,
      particulars: r.particulars,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
      type,
      detectedFdNumber,
    };
  });
}
```

- [ ] **Step 2: Commit parse-pdf + ai-parser together**

```bash
git add package.json package-lock.json src/lib/fd-statement/parse-pdf.ts src/lib/fd-statement/ai-parser.ts
git commit -m "feat(fd-statement): pdf orchestrator + Haiku fallback"
```

---

## Task 8: API — POST /api/fd/statements/parse

**Files:**
- Create: `src/app/api/fd/statements/parse/route.ts`

- [ ] **Step 1: Verify how current FD routes resolve the authed userId**

Run: `grep -n "userId" src/app/api/fd/route.ts | head -20`
Use the **same pattern** for getting `userId` in this new route (usually from a `getServerSession`/auth helper).

- [ ] **Step 2: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // or whatever the project uses
import { parseStatementPdf } from "@/lib/fd-statement/parse-pdf";
import { matchFd } from "@/lib/fd-statement/match";
import type { MatchCandidate } from "@/lib/fd-statement/types";
import { getUserId } from "@/lib/auth-helpers"; // adapt to the real helper

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const bankName = (form.get("bankName") as string | null)?.trim();
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!bankName) return NextResponse.json({ error: "Bank required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF exceeds 10 MB" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const { txns, parseMethod } = await parseStatementPdf(bytes);
  if (txns.length === 0) {
    return NextResponse.json({ error: "Could not parse statement; please check format" }, { status: 422 });
  }

  const fds = await prisma.fixedDeposit.findMany({
    where: { userId, bankName },
    select: { id: true, fdNumber: true, accountNumber: true, maturityDate: true, principal: true },
  });
  const candidates: MatchCandidate[] = fds.map((f) => ({
    fdId: f.id,
    fdNumber: f.fdNumber,
    accountNumber: f.accountNumber,
    label: `${f.fdNumber ?? f.accountNumber ?? "FD"} — ₹${f.principal}`,
    maturityDate: f.maturityDate.toISOString().slice(0, 10),
  }));

  const enriched = txns.map((t) => {
    const m = matchFd(t.detectedFdNumber, candidates);
    const matchedFd = m.kind === "matched" ? candidates.find((c) => c.fdId === m.fdId) : null;
    let type = t.type;
    if (type === "maturity" && matchedFd && t.txnDate < matchedFd.maturityDate) {
      type = "premature_close";
    }
    return {
      ...t,
      type,
      match: m,
      suggestedFdId: m.kind === "matched" ? m.fdId : null,
    };
  });

  const matchedCount = enriched.filter((t) => t.suggestedFdId).length;
  const dates = txns.map((t) => t.txnDate).sort();
  return NextResponse.json({
    parseMethod,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    txnCount: txns.length,
    matchedCount,
    candidates,
    txns: enriched,
  });
}
```

- [ ] **Step 3: Smoke test manually**

Run dev server: `npm run dev`. Use curl/Postman to POST the sample PDF at `/Users/sushantgawali/Downloads/statement-50.pdf` with `bankName=Lokmanya Multi Purpose Co-Operative Society Ltd.`. Confirm response contains `txns` array.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fd/statements/parse/route.ts
git commit -m "feat(fd-statement): /api/fd/statements/parse endpoint"
```

---

## Task 9: API — statements persistence + list + detail + delete + pdf

**Files:**
- Create: `src/app/api/fd/statements/route.ts`
- Create: `src/app/api/fd/statements/[id]/route.ts`
- Create: `src/app/api/fd/statements/[id]/pdf/route.ts`

- [ ] **Step 1: `POST` save + `GET` list**

Create `src/app/api/fd/statements/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";
import type { TxnType } from "@/lib/fd-statement/types";

interface SaveTxn {
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
  fdId: string | null;
  skip?: boolean;
}

interface SavePayload {
  bankName: string;
  fileName: string;
  sourcePdfUrl: string;
  fromDate: string | null;
  toDate: string | null;
  parseMethod: "regex" | "ai";
  txns: SaveTxn[];
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as SavePayload;
  const kept = body.txns.filter((t) => !t.skip);

  const result = await prisma.$transaction(async (tx) => {
    const statement = await tx.fDStatement.create({
      data: {
        userId,
        bankName: body.bankName,
        fileName: body.fileName,
        sourcePdfUrl: body.sourcePdfUrl,
        fromDate: body.fromDate ? new Date(body.fromDate) : null,
        toDate: body.toDate ? new Date(body.toDate) : null,
        parseMethod: body.parseMethod,
        txnCount: kept.length,
        matchedCount: kept.filter((t) => t.fdId).length,
      },
    });
    let inserted = 0;
    let skipped = 0;
    for (const t of kept) {
      try {
        await tx.fDStatementTxn.create({
          data: {
            statementId: statement.id,
            fdId: t.fdId,
            txnDate: new Date(t.txnDate),
            particulars: t.particulars,
            debit: t.debit,
            credit: t.credit,
            type: t.type,
            detectedFdNumber: t.detectedFdNumber,
          },
        });
        inserted++;
      } catch (e) {
        // unique violation on (statementId, txnDate, particulars, debit, credit)
        skipped++;
      }
    }
    return { statementId: statement.id, inserted, skipped };
  });

  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await prisma.fDStatement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true, bankName: true, fileName: true, fromDate: true, toDate: true,
      txnCount: true, matchedCount: true, uploadedAt: true, parseMethod: true,
    },
  });
  return NextResponse.json(list);
}
```

- [ ] **Step 2: Detail + delete**

Create `src/app/api/fd/statements/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";

// NOTE: Next 16 — params may be a Promise. Check node_modules/next/dist/docs for app router route handler signatures before writing the signature.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const statement = await prisma.fDStatement.findFirst({
    where: { id, userId },
    include: {
      transactions: {
        orderBy: { txnDate: "desc" },
        include: { fd: { select: { id: true, fdNumber: true, accountNumber: true, principal: true } } },
      },
    },
  });
  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(statement);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stmt = await prisma.fDStatement.findFirst({ where: { id, userId } });
  if (!stmt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.fDStatement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: PDF redirect route**

Create `src/app/api/fd/statements/[id]/pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stmt = await prisma.fDStatement.findFirst({ where: { id, userId }, select: { sourcePdfUrl: true } });
  if (!stmt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(new URL(stmt.sourcePdfUrl, req.url));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fd/statements
git commit -m "feat(fd-statement): list/detail/delete/pdf routes"
```

---

## Task 10: UI — Statements list page

**Files:**
- Create: `src/app/dashboard/fd/statements/page.tsx`
- Create: `src/app/dashboard/fd/statements/statements-list.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/dashboard/fd/statements/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { StatementsList } from "./statements-list";

export default async function StatementsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const items = await prisma.fDStatement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
  });
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bank Statements</h1>
        <Link href="/dashboard/fd/statements/new" className="btn btn-primary">Upload Statement</Link>
      </div>
      <StatementsList items={JSON.parse(JSON.stringify(items))} />
    </div>
  );
}
```

- [ ] **Step 2: Client list + delete**

```tsx
// src/app/dashboard/fd/statements/statements-list.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

type Item = {
  id: string; bankName: string; fileName: string;
  fromDate: string | null; toDate: string | null;
  txnCount: number; matchedCount: number; uploadedAt: string; parseMethod: string;
};

export function StatementsList({ items }: { items: Item[] }) {
  const router = useRouter();
  async function del(id: string) {
    if (!confirm("Delete this statement and all its transactions?")) return;
    const r = await fetch(`/api/fd/statements/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
  }
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No statements uploaded yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className="text-left p-2">Bank</th>
        <th className="text-left p-2">Period</th>
        <th className="text-left p-2">Uploaded</th>
        <th className="text-right p-2">Txns</th>
        <th className="text-right p-2">Matched</th>
        <th className="p-2">Actions</th>
      </tr></thead>
      <tbody>
        {items.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="p-2">{s.bankName}</td>
            <td className="p-2">{s.fromDate ? `${formatDate(s.fromDate)} – ${formatDate(s.toDate!)}` : "—"}</td>
            <td className="p-2">{formatDate(s.uploadedAt)}</td>
            <td className="p-2 text-right">{s.txnCount}</td>
            <td className="p-2 text-right">{s.matchedCount}</td>
            <td className="p-2 space-x-2">
              <Link href={`/dashboard/fd/statements/${s.id}`} className="underline">View</Link>
              <a href={`/api/fd/statements/${s.id}/pdf`} className="underline">PDF</a>
              <button onClick={() => del(s.id)} className="text-red-600">Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/statements/page.tsx src/app/dashboard/fd/statements/statements-list.tsx
git commit -m "feat(fd-statement): statements list page"
```

---

## Task 11: UI — Upload & Review wizard

**Files:**
- Create: `src/app/dashboard/fd/statements/new/page.tsx`
- Create: `src/app/dashboard/fd/statements/new/statement-upload-form.tsx`

- [ ] **Step 1: Server page loads bank list**

```tsx
// src/app/dashboard/fd/statements/new/page.tsx
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { StatementUploadForm } from "./statement-upload-form";

export default async function NewStatementPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const banks = await prisma.fixedDeposit.findMany({
    where: { userId, disabled: false },
    distinct: ["bankName"],
    select: { bankName: true },
    orderBy: { bankName: "asc" },
  });
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload Bank Statement</h1>
      <StatementUploadForm banks={banks.map((b) => b.bankName)} />
    </div>
  );
}
```

- [ ] **Step 2: Client 3-step wizard**

```tsx
// src/app/dashboard/fd/statements/new/statement-upload-form.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TxnType, MatchCandidate } from "@/lib/fd-statement/types";

type ReviewTxn = {
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: TxnType;
  detectedFdNumber: string | null;
  fdId: string | null;
  skip: boolean;
};

type ParseResp = {
  parseMethod: "regex" | "ai";
  fromDate: string;
  toDate: string;
  txnCount: number;
  matchedCount: number;
  candidates: MatchCandidate[];
  txns: (ReviewTxn & { match: unknown; suggestedFdId: string | null })[];
};

export function StatementUploadForm({ banks }: { banks: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [bank, setBank] = useState(banks[0] ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResp | null>(null);
  const [txns, setTxns] = useState<ReviewTxn[]>([]);
  const [showOther, setShowOther] = useState(false);

  async function doParse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file || !bank) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bankName", bank);
    const r = await fetch("/api/fd/statements/parse", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Parse failed");
      return;
    }
    const data = (await r.json()) as ParseResp;
    setParsed(data);
    setTxns(
      data.txns.map((t) => ({
        txnDate: t.txnDate,
        particulars: t.particulars,
        debit: t.debit,
        credit: t.credit,
        type: t.type,
        detectedFdNumber: t.detectedFdNumber,
        fdId: t.suggestedFdId,
        skip: t.type === "other",
      })),
    );
    setStep(2);
  }

  async function doSave() {
    if (!parsed || !file) return;
    setBusy(true);
    // 1. Upload the PDF via existing /api/fd/upload to get sourcePdfUrl
    const up = new FormData();
    up.append("file", file);
    const ur = await fetch("/api/fd/upload", { method: "POST", body: up });
    if (!ur.ok) { setBusy(false); setError("Upload failed"); return; }
    const { url } = (await ur.json()) as { url: string };

    // 2. Save statement
    const res = await fetch("/api/fd/statements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bankName: bank,
        fileName: file.name,
        sourcePdfUrl: url,
        fromDate: parsed.fromDate,
        toDate: parsed.toDate,
        parseMethod: parsed.parseMethod,
        txns,
      }),
    });
    setBusy(false);
    if (!res.ok) { setError("Save failed"); return; }
    router.push("/dashboard/fd/statements");
    router.refresh();
  }

  if (step === 1) {
    return (
      <form onSubmit={doParse} className="space-y-4">
        <label className="block">Bank
          <select value={bank} onChange={(e) => setBank(e.target.value)} className="block w-full border rounded p-2">
            {banks.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="block">PDF
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button disabled={busy || !file || !bank} className="btn btn-primary">
          {busy ? "Parsing…" : "Parse"}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    );
  }

  const filtered = txns.map((t, i) => ({ t, i })).filter(({ t }) => showOther || (t.type !== "other" && t.type !== "tds"));
  const matched = txns.filter((t) => t.fdId && !t.skip).length;
  const unmatched = txns.filter((t) => !t.fdId && !t.skip && t.type !== "other" && t.type !== "tds").length;

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <strong>{parsed?.txnCount}</strong> transactions parsed via <em>{parsed?.parseMethod}</em>. Matched: {matched}. Unmatched: {unmatched}.
        <label className="ml-4"><input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} /> Show skipped / other / TDS</label>
      </div>
      <table className="w-full text-xs">
        <thead><tr>
          <th className="p-1 text-left">Date</th>
          <th className="p-1 text-left">Type</th>
          <th className="p-1 text-left">Particulars</th>
          <th className="p-1 text-right">Amount</th>
          <th className="p-1 text-left">FD</th>
          <th className="p-1">Skip</th>
        </tr></thead>
        <tbody>
          {filtered.map(({ t, i }) => (
            <tr key={i} className={`border-t ${!t.fdId && !t.skip && t.type !== "other" && t.type !== "tds" ? "bg-yellow-50" : ""}`}>
              <td className="p-1">{t.txnDate}</td>
              <td className="p-1">{t.type}</td>
              <td className="p-1">{t.particulars}</td>
              <td className="p-1 text-right">{t.credit > 0 ? `+${t.credit}` : `-${t.debit}`}</td>
              <td className="p-1">
                <select
                  value={t.fdId ?? ""}
                  onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, fdId: e.target.value || null } : x))}
                  className="border rounded p-1"
                >
                  <option value="">— unmatched —</option>
                  {parsed!.candidates.map((c) => <option key={c.fdId} value={c.fdId}>{c.label}</option>)}
                </select>
              </td>
              <td className="p-1 text-center">
                <input type="checkbox" checked={t.skip} onChange={(e) => setTxns((prev) => prev.map((x, j) => j === i ? { ...x, skip: e.target.checked } : x))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button onClick={() => setStep(1)} className="btn">Back</button>
        <button onClick={doSave} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save"}</button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/statements/new
git commit -m "feat(fd-statement): upload + review wizard"
```

---

## Task 12: UI — Statement detail page

**Files:**
- Create: `src/app/dashboard/fd/statements/[id]/page.tsx`

- [ ] **Step 1: Page**

```tsx
// src/app/dashboard/fd/statements/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getUserId } from "@/lib/auth-helpers";
import { formatDate, formatINR } from "@/lib/format";

export default async function StatementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const s = await prisma.fDStatement.findFirst({
    where: { id, userId },
    include: { transactions: { orderBy: { txnDate: "desc" }, include: { fd: true } } },
  });
  if (!s) notFound();
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">{s.bankName} — {s.fileName}</h1>
        <a href={`/api/fd/statements/${s.id}/pdf`} className="btn">Download PDF</a>
      </div>
      <p className="text-sm text-muted-foreground">
        Period {s.fromDate ? formatDate(s.fromDate) : "—"} → {s.toDate ? formatDate(s.toDate) : "—"} · {s.txnCount} txns · {s.matchedCount} matched · parsed by {s.parseMethod}
      </p>
      <table className="w-full text-sm">
        <thead><tr>
          <th className="p-2 text-left">Date</th>
          <th className="p-2 text-left">Type</th>
          <th className="p-2 text-left">Particulars</th>
          <th className="p-2 text-right">Amount</th>
          <th className="p-2 text-left">FD</th>
        </tr></thead>
        <tbody>
          {s.transactions.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{formatDate(t.txnDate)}</td>
              <td className="p-2">{t.type}</td>
              <td className="p-2">{t.particulars}</td>
              <td className="p-2 text-right">{t.credit > 0 ? `+${formatINR(t.credit)}` : `-${formatINR(t.debit)}`}</td>
              <td className="p-2">
                {t.fd ? <Link className="underline" href={`/dashboard/fd/${t.fd.id}`}>{t.fd.fdNumber ?? t.fd.accountNumber}</Link> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/dashboard/fd/statements/[id]/page.tsx"
git commit -m "feat(fd-statement): statement detail page"
```

---

## Task 13: FD expanded area — "Interest & Transactions" section

**Files:**
- Create: `src/app/dashboard/fd/statements/fd-txn-section.tsx`
- Modify: `src/app/dashboard/fd/fd-detail-content.tsx`

- [ ] **Step 1: Section component (server-fetched data passed in)**

```tsx
// src/app/dashboard/fd/statements/fd-txn-section.tsx
import Link from "next/link";
import { formatDate, formatINR } from "@/lib/format";

export interface FdTxnRow {
  id: string;
  txnDate: string;
  particulars: string;
  debit: number;
  credit: number;
  type: string;
  statementId: string;
}

const TYPE_LABEL: Record<string, string> = {
  interest: "Interest",
  maturity: "Maturity",
  premature_close: "Premature Close",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  tds: "TDS",
  other: "Other",
};

export function FdTxnSection({ rows }: { rows: FdTxnRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="font-medium mb-2">Interest & Transactions</h3>
      <table className="w-full text-sm">
        <thead><tr>
          <th className="p-1 text-left">Date</th>
          <th className="p-1 text-left">Type</th>
          <th className="p-1 text-left">Particulars</th>
          <th className="p-1 text-right">Amount</th>
          <th className="p-1 text-left">Statement</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-1">{formatDate(r.txnDate)}</td>
              <td className="p-1">{TYPE_LABEL[r.type] ?? r.type}</td>
              <td className="p-1">{r.particulars}</td>
              <td className="p-1 text-right">{r.credit > 0 ? `+${formatINR(r.credit)}` : `-${formatINR(r.debit)}`}</td>
              <td className="p-1"><Link className="underline" href={`/dashboard/fd/statements/${r.statementId}`}>View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Wire into fd-detail-content**

Read `src/app/dashboard/fd/fd-detail-content.tsx` and `src/app/dashboard/fd/[id]/page.tsx` to learn how data is currently passed. Then:

1. In the server page (`[id]/page.tsx`), fetch transactions:

```ts
const txns = await prisma.fDStatementTxn.findMany({
  where: { fdId: fd.id },
  orderBy: { txnDate: "desc" },
  select: { id: true, txnDate: true, particulars: true, debit: true, credit: true, type: true, statementId: true },
});
```

2. Pass `txns` as a new prop to `<FDDetailContent />`, update the `FDDetailData` interface to include `txns: FdTxnRow[]`.

3. In `fd-detail-content.tsx`, import and render `<FdTxnSection rows={data.txns} />` after the existing sections (near the bottom of the expanded area).

- [ ] **Step 3: Smoke test**

Upload `statement-50.pdf` via the new flow. Open an affected FD (e.g., one with `fdNumber` ending in `18883`). Confirm the new section shows interest rows from `01-Jul-2024`, `01-Oct-2024`, etc.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/statements/fd-txn-section.tsx src/app/dashboard/fd/fd-detail-content.tsx "src/app/dashboard/fd/[id]/page.tsx"
git commit -m "feat(fd): show statement txns in FD detail"
```

---

## Task 14: Add "Statements" link to FD list page

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx` (or `fd-list.tsx` header)

- [ ] **Step 1: Add link**

Find the header row (has e.g. "New FD" / "Bulk" links). Add:

```tsx
<Link href="/dashboard/fd/statements" className="btn">Statements</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/fd
git commit -m "feat(fd): link to statements from FD list"
```

---

## Task 15: End-to-end smoke + cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual E2E**

1. `npm run dev`
2. Navigate to `/dashboard/fd/statements`.
3. Click Upload. Pick bank "Lokmanya Multi Purpose Co-Operative Society Ltd." (or the exact bank name of the Lokmanya FDs in your data).
4. Upload `~/Downloads/statement-50.pdf`.
5. Verify review screen shows `Int. FD-...` rows matched to the right FDs, `MAT FD 18883 CLSD` correctly tagged `maturity`, TDS entry is `skip=true` by default.
6. Save.
7. Go to the FD whose `fdNumber` matches an interest row. Confirm "Interest & Transactions" section renders with correct dates/amounts.
8. Re-upload the same PDF. Confirm save reports `inserted: 0, skipped: N` (idempotent).
9. Download PDF from statements list — confirm correct file.
10. Delete a statement — confirm its txns disappear from the FD detail page.

- [ ] **Step 4: No commit (verification only)**

---

## Self-Review Notes

- **Spec coverage:** Upload flow (T8, T11), history (T10, T12), re-download (T10, T12), FD expanded area (T13), idempotent dedupe (T9, T15 step 3.8), regex-first + AI fallback (T5, T6, T7), user-picked bank (T11), bank-scoped matching (T4, T8), premature close refinement (T8), TDS handling (T3), review step with manual FD pick (T11), delete (T9, T10). All covered.
- **Placeholder scan:** Two intentional references to project-specific helpers (`prisma`, `getUserId`, `formatINR`, `formatDate`) — these exist in the codebase; Task 8 Step 1 tells the implementer to confirm the exact import paths. Step 2 of Task 13 says "Read fd-detail-content.tsx first" — this is real guidance, not a placeholder. No TBD/TODO.
- **Type consistency:** `ParsedTxn`, `MatchCandidate`, `MatchResult`, `TxnType` defined in Task 2 and used consistently in Tasks 3–11. `FdTxnRow` is defined in Task 13 only.
- **Next 16 note:** Route params are typed as `Promise<{ id: string }>` throughout — this matches the Next 16 breaking change flagged in AGENTS.md.
