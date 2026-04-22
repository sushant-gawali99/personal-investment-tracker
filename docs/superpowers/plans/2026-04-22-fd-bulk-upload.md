# FD Bulk Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated bulk-upload page where the user can drop multiple PDFs, images, or a zip containing them, extract FD fields per file via the existing Claude endpoint with live progress, review/edit results in a table, and save selected FDs.

**Architecture:** All parallelism and progress tracking lives on the client. A `useReducer` in `bulk-upload-form.tsx` holds per-row state. Each row calls the existing single-file `/api/fd/extract`, `/api/fd/upload`, and `POST /api/fd` endpoints — no new job/queue server state. One new lightweight endpoint (`GET /api/fd/duplicates`) flags existing FDs. Zip files are unpacked in the browser via `jszip`.

**Tech Stack:** Next.js 16 App Router, React 19, react-dropzone, jszip (new dep), lucide-react icons, Prisma/LibSQL (read-only — no schema changes).

**Spec:** `docs/superpowers/specs/2026-04-22-fd-bulk-upload-design.md`

**Known deviation from spec:** The spec proposed extracting the FD field inputs from `fd-new-form.tsx` into a shared `_shared/fd-fields.tsx` module. In practice the existing form's inputs are deeply entangled with its `FDForm` reducer, `invalidSections` marking, and section refs — extracting them cleanly requires a substantial refactor of `fd-new-form.tsx` that risks regressing the single-FD flow. This plan creates a self-contained `bulk-row-editor.tsx` instead. If the field set diverges later, revisit the shared-module idea as a separate follow-up.

---

### Task 1: Add `jszip` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install jszip**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npm install jszip@^3.10.1
```

Expected: `added 1 package` (or similar); `package.json` gains a `"jszip": "^3.10.1"` entry under dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip for bulk zip extraction"
```

---

### Task 2: Concurrency helper

**Files:**
- Create: `src/lib/bulk-queue.ts`

- [ ] **Step 1: Create the helper**

Write `src/lib/bulk-queue.ts` with exactly this content:

```ts
/**
 * Runs `fn(item, index)` over `items` with at most `limit` promises in flight.
 * Results are returned in the original order. Errors are captured per-slot as
 * `{ ok: false, error }` — callers decide how to handle them.
 *
 * If `signal` aborts, no new slots are scheduled; already-started slots settle.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> =
    new Array(items.length);

  let cursor = 0;

  async function worker() {
    while (true) {
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await fn(items[i], i);
        results[i] = { ok: true, value };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bulk-queue.ts
git commit -m "feat(bulk): add concurrency queue helper"
```

---

### Task 3: Zip expander

**Files:**
- Create: `src/lib/zip.ts`

- [ ] **Step 1: Create the helper**

Write `src/lib/zip.ts` with exactly this content:

```ts
import JSZip from "jszip";

const SUPPORTED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function isSupported(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTS.some((ext) => lower.endsWith(ext));
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot + 1) : "";
}

/**
 * Expands a .zip File into a flat array of File objects for supported types
 * (pdf / jpg / jpeg / png / webp). Unsupported entries, directories, and
 * macOS metadata files (__MACOSX/, .DS_Store) are silently ignored.
 *
 * Throws if the zip cannot be parsed — callers should surface a toast.
 */
export async function expandZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const out: File[] = [];

  const entries = Object.values(zip.files).filter(
    (e) =>
      !e.dir &&
      !e.name.startsWith("__MACOSX/") &&
      !e.name.endsWith("/.DS_Store") &&
      !e.name.endsWith(".DS_Store") &&
      isSupported(e.name),
  );

  for (const entry of entries) {
    const blob = await entry.async("blob");
    const baseName = entry.name.split("/").pop() || entry.name;
    const ext = extOf(baseName);
    const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";
    out.push(new File([blob], baseName, { type: mime }));
  }

  return out;
}

export function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/zip.ts
git commit -m "feat(bulk): add client-side zip expander"
```

---

### Task 4: Duplicate-check endpoint

**Files:**
- Create: `src/app/api/fd/duplicates/route.ts`

- [ ] **Step 1: Create the route**

Write `src/app/api/fd/duplicates/route.ts` with exactly this content:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const MAX_KEYS = 20;

/**
 * GET /api/fd/duplicates?keys=<bank>|<fdNumber>,<bank>|<fdNumber>,...
 * Returns which (bankName, fdNumber) tuples already exist for the current user.
 */
export async function GET(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const raw = req.nextUrl.searchParams.get("keys") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ duplicates: [] });
  }

  const parts = raw.split(",").slice(0, MAX_KEYS);
  const keys = parts
    .map((p) => {
      const pipe = p.indexOf("|");
      if (pipe < 0) return null;
      const bankName = p.slice(0, pipe).trim();
      const fdNumber = p.slice(pipe + 1).trim();
      if (!bankName || !fdNumber) return null;
      return { bankName, fdNumber };
    })
    .filter((k): k is { bankName: string; fdNumber: string } => k !== null);

  if (keys.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  const matches = await prisma.fixedDeposit.findMany({
    where: {
      userId,
      OR: keys.map((k) => ({ bankName: k.bankName, fdNumber: k.fdNumber })),
    },
    select: { bankName: true, fdNumber: true },
  });

  return NextResponse.json({
    duplicates: matches.map((m) => ({
      bankName: m.bankName,
      fdNumber: m.fdNumber,
    })),
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verify**

Start the dev server (`npm run dev`), log in, and in the browser console run:

```js
fetch("/api/fd/duplicates?keys=HDFC|123,SBI|456").then(r => r.json()).then(console.log)
```

Expected: `{ duplicates: [] }` if none match, or a populated array if any FD with matching bank+fdNumber exists for the user.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/fd/duplicates/route.ts
git commit -m "feat(fd): add bulk-duplicate check endpoint"
```

---

### Task 5: Page scaffold — server component

**Files:**
- Create: `src/app/dashboard/fd/bulk/page.tsx`

- [ ] **Step 1: Create the server page**

Write `src/app/dashboard/fd/bulk/page.tsx` with exactly this content:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { BulkUploadForm } from "./bulk-upload-form";

export default async function BulkUploadPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/api/auth/signin");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/fd"
          className="text-[13px] text-[#a0a0a5] hover:text-[#ededed] inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to FDs
        </Link>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight mt-2">
          Bulk Upload FDs
        </h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Drop up to 20 files — PDFs, images, or a .zip. Each file becomes one FD.
        </p>
      </div>
      <BulkUploadForm />
    </div>
  );
}
```

- [ ] **Step 2: Commit** (page imports `BulkUploadForm` which is built in Task 10 — commit anyway; tsc check runs at end of Task 10)

```bash
git add src/app/dashboard/fd/bulk/page.tsx
git commit -m "feat(fd-bulk): add page scaffold"
```

---

### Task 6: Drop zone component

**Files:**
- Create: `src/app/dashboard/fd/bulk/bulk-drop-zone.tsx`

- [ ] **Step 1: Create the drop zone**

Write `src/app/dashboard/fd/bulk/bulk-drop-zone.tsx` with exactly this content:

```tsx
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_ZIP_SIZE = 20 * 1024 * 1024; // 20 MB

export function BulkDropZone({
  currentCount,
  onFiles,
  disabled,
}: {
  currentCount: number;
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const onDrop = useCallback(
    (files: File[]) => {
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [],
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "application/zip": [],
      "application/x-zip-compressed": [],
    },
    disabled,
    multiple: true,
  });

  const remaining = MAX_FILES - currentCount;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors bg-[#17171a]",
        isDragActive
          ? "border-[#ff385c] bg-[#2a1218]"
          : "border-[#3a3a3f] hover:border-[#ff385c] hover:bg-[#2a1218]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <input {...getInputProps()} />
      <Upload size={24} className="mx-auto mb-2 text-[#a0a0a5]" />
      <p className="text-[14px] text-[#ededed]">
        {isDragActive ? "Drop here" : "Drop files or a .zip here, or click to browse"}
      </p>
      <p className="text-[12px] text-[#a0a0a5] mt-1">
        PDF, JPEG, PNG, WebP — up to {remaining} more file{remaining === 1 ? "" : "s"}, 5 MB each.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-drop-zone.tsx
git commit -m "feat(fd-bulk): add drop zone"
```

---

### Task 7: Reducer + types + state skeleton

**Files:**
- Create: `src/app/dashboard/fd/bulk/bulk-state.ts`

- [ ] **Step 1: Create the state module**

Write `src/app/dashboard/fd/bulk/bulk-state.ts` with exactly this content:

```ts
export type RowStatus =
  | "pending"
  | "extracting"
  | "extracted"
  | "extract_failed"
  | "saving"
  | "saved"
  | "save_failed";

export type FdExtracted = {
  bankName: string | null;
  fdNumber: string | null;
  accountNumber: string | null;
  principal: number | null;
  interestRate: number | null;
  tenureMonths: number | null;
  tenureDays: number | null;
  tenureText: string | null;
  startDate: string | null;
  maturityDate: string | null;
  maturityAmount: number | null;
  interestType: "simple" | "compound" | null;
  compoundFreq: "monthly" | "quarterly" | "annually" | null;
  maturityInstruction: string | null;
  payoutFrequency: string | null;
  nomineeName: string | null;
  nomineeRelation: string | null;
};

export type EditableFields = {
  bankName: string;
  fdNumber: string;
  accountNumber: string;
  principal: string;
  interestRate: string;
  tenureMonths: string;
  tenureDays: string;
  tenureText: string;
  startDate: string;
  maturityDate: string;
  maturityAmount: string;
  interestType: string;
  compoundFreq: string;
  maturityInstruction: string;
  payoutFrequency: string;
  nomineeName: string;
  nomineeRelation: string;
};

export type BulkRow = {
  id: string;
  file: File;
  kind: "pdf" | "image";
  status: RowStatus;
  error?: string;
  isDuplicate?: boolean;
  selected: boolean;
  extracted?: FdExtracted;
  edited: Partial<EditableFields>;
};

export type BulkState = { rows: BulkRow[] };

export type BulkAction =
  | { type: "ADD_ROWS"; rows: BulkRow[] }
  | { type: "REMOVE_ROW"; id: string }
  | { type: "SET_STATUS"; id: string; status: RowStatus; error?: string }
  | { type: "SET_EXTRACTED"; id: string; extracted: FdExtracted }
  | { type: "SET_DUPLICATES"; keys: Array<{ bankName: string; fdNumber: string }> }
  | { type: "TOGGLE_SELECTED"; id: string }
  | { type: "SET_SELECTED"; id: string; selected: boolean }
  | { type: "EDIT_FIELD"; id: string; field: keyof EditableFields; value: string }
  | { type: "RESET" };

export function extractedToEditable(e: FdExtracted): Partial<EditableFields> {
  const toStr = (v: number | null) => (v == null ? "" : String(v));
  const toDate = (v: string | null) => {
    if (!v) return "";
    try {
      return new Date(v).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };
  return {
    bankName: e.bankName ?? "",
    fdNumber: e.fdNumber ?? "",
    accountNumber: e.accountNumber ?? "",
    principal: toStr(e.principal),
    interestRate: toStr(e.interestRate),
    tenureMonths: toStr(e.tenureMonths),
    tenureDays: toStr(e.tenureDays),
    tenureText: e.tenureText ?? "",
    startDate: toDate(e.startDate),
    maturityDate: toDate(e.maturityDate),
    maturityAmount: toStr(e.maturityAmount),
    interestType: e.interestType ?? "compound",
    compoundFreq: e.compoundFreq ?? "quarterly",
    maturityInstruction: e.maturityInstruction ?? "",
    payoutFrequency: e.payoutFrequency ?? "",
    nomineeName: e.nomineeName ?? "",
    nomineeRelation: e.nomineeRelation ?? "",
  };
}

export const initialState: BulkState = { rows: [] };

export function bulkReducer(state: BulkState, action: BulkAction): BulkState {
  switch (action.type) {
    case "ADD_ROWS":
      return { rows: [...state.rows, ...action.rows] };

    case "REMOVE_ROW":
      return { rows: state.rows.filter((r) => r.id !== action.id) };

    case "SET_STATUS":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, status: action.status, error: action.error } : r,
        ),
      };

    case "SET_EXTRACTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id
            ? {
                ...r,
                extracted: action.extracted,
                edited: { ...extractedToEditable(action.extracted), ...r.edited },
              }
            : r,
        ),
      };

    case "SET_DUPLICATES": {
      const keySet = new Set(
        action.keys.map((k) => `${k.bankName}|${k.fdNumber}`),
      );
      return {
        rows: state.rows.map((r) => {
          const bank = r.edited.bankName ?? r.extracted?.bankName ?? "";
          const fdn = r.edited.fdNumber ?? r.extracted?.fdNumber ?? "";
          const isDup = bank && fdn ? keySet.has(`${bank}|${fdn}`) : false;
          return { ...r, isDuplicate: isDup };
        }),
      };
    }

    case "TOGGLE_SELECTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, selected: !r.selected } : r,
        ),
      };

    case "SET_SELECTED":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, selected: action.selected } : r,
        ),
      };

    case "EDIT_FIELD":
      return {
        rows: state.rows.map((r) =>
          r.id === action.id
            ? { ...r, edited: { ...r.edited, [action.field]: action.value } }
            : r,
        ),
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function mergedFields(row: BulkRow): EditableFields {
  const base: EditableFields = {
    bankName: "",
    fdNumber: "",
    accountNumber: "",
    principal: "",
    interestRate: "",
    tenureMonths: "",
    tenureDays: "",
    tenureText: "",
    startDate: "",
    maturityDate: "",
    maturityAmount: "",
    interestType: "compound",
    compoundFreq: "quarterly",
    maturityInstruction: "",
    payoutFrequency: "",
    nomineeName: "",
    nomineeRelation: "",
  };
  return { ...base, ...row.edited };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-state.ts
git commit -m "feat(fd-bulk): add reducer and row state types"
```

---

### Task 8: Row editor (expanded form)

**Files:**
- Create: `src/app/dashboard/fd/bulk/bulk-row-editor.tsx`

(Editor created BEFORE the table so the table's import resolves immediately.)

- [ ] **Step 1: Create the editor**

Write `src/app/dashboard/fd/bulk/bulk-row-editor.tsx` with exactly this content:

```tsx
"use client";

import { DatePicker } from "@/components/ui/date-picker";
import type { BulkRow, EditableFields } from "./bulk-state";

type Props = {
  row: BulkRow;
  onEditField: (field: keyof EditableFields, value: string) => void;
};

export function BulkRowEditor({ row, onEditField }: Props) {
  const f = row.edited;
  const v = (k: keyof EditableFields) => f[k] ?? "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="ab-label">Bank Name *</label>
        <input
          className="ab-input"
          value={v("bankName")}
          onChange={(e) => onEditField("bankName", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Principal (₹) *</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("principal")}
          onChange={(e) => onEditField("principal", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Interest Rate (% p.a.) *</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("interestRate")}
          onChange={(e) => onEditField("interestRate", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Tenure (months)</label>
        <input
          type="number"
          min="0"
          className="ab-input mono"
          value={v("tenureMonths")}
          onChange={(e) => onEditField("tenureMonths", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Tenure (days)</label>
        <input
          type="number"
          min="0"
          className="ab-input mono"
          value={v("tenureDays")}
          onChange={(e) => onEditField("tenureDays", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Maturity Amount (₹)</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("maturityAmount")}
          onChange={(e) => onEditField("maturityAmount", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Start Date *</label>
        <DatePicker value={v("startDate")} onChange={(val) => onEditField("startDate", val)} required />
      </div>
      <div>
        <label className="ab-label">Maturity Date *</label>
        <DatePicker value={v("maturityDate")} onChange={(val) => onEditField("maturityDate", val)} required />
      </div>
      <div>
        <label className="ab-label">Interest Type</label>
        <select
          className="ab-input"
          value={v("interestType") || "compound"}
          onChange={(e) => onEditField("interestType", e.target.value)}
        >
          <option value="compound">Compound</option>
          <option value="simple">Simple</option>
        </select>
      </div>
      {v("interestType") !== "simple" && (
        <div>
          <label className="ab-label">Compounding Frequency</label>
          <select
            className="ab-input"
            value={v("compoundFreq") || "quarterly"}
            onChange={(e) => onEditField("compoundFreq", e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      )}
      <div>
        <label className="ab-label">FD Number</label>
        <input
          className="ab-input"
          value={v("fdNumber")}
          onChange={(e) => onEditField("fdNumber", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Account Number</label>
        <input
          className="ab-input"
          value={v("accountNumber")}
          onChange={(e) => onEditField("accountNumber", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Maturity Instruction</label>
        <select
          className="ab-input"
          value={v("maturityInstruction")}
          onChange={(e) => onEditField("maturityInstruction", e.target.value)}
        >
          <option value="">Not specified</option>
          <option value="renew_principal_interest">Auto-renew principal + interest</option>
          <option value="renew_principal">Auto-renew principal, payout interest</option>
          <option value="payout">Credit to savings on maturity</option>
        </select>
      </div>
      <div>
        <label className="ab-label">Payout Frequency</label>
        <select
          className="ab-input"
          value={v("payoutFrequency")}
          onChange={(e) => onEditField("payoutFrequency", e.target.value)}
        >
          <option value="">Not specified</option>
          <option value="on_maturity">On maturity (cumulative)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="half_yearly">Half-yearly</option>
          <option value="annually">Annually</option>
        </select>
      </div>
      <div>
        <label className="ab-label">Nominee Name</label>
        <input
          className="ab-input"
          value={v("nomineeName")}
          onChange={(e) => onEditField("nomineeName", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Nominee Relation</label>
        <input
          className="ab-input"
          value={v("nomineeRelation")}
          onChange={(e) => onEditField("nomineeRelation", e.target.value)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-row-editor.tsx
git commit -m "feat(fd-bulk): add expandable row editor"
```

---

### Task 9: Row table

**Files:**
- Create: `src/app/dashboard/fd/bulk/bulk-row-table.tsx`

- [ ] **Step 1: Create the table**

Write `src/app/dashboard/fd/bulk/bulk-row-table.tsx` with exactly this content. The two `<tr>` elements per row are grouped with `React.Fragment` keyed by `row.id`.

```tsx
"use client";

import { Fragment, useState } from "react";
import { Loader2, Check, X, AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Trash2, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkRow, RowStatus, EditableFields } from "./bulk-state";
import { BulkRowEditor } from "./bulk-row-editor";

function StatusPill({ status, error }: { status: RowStatus; error?: string }) {
  if (status === "pending") {
    return <span className="ab-chip" title="Pending">Pending</span>;
  }
  if (status === "extracting" || status === "saving") {
    return (
      <span className="ab-chip" title={status}>
        <Loader2 size={12} className="animate-spin" />
        {status === "extracting" ? "Extracting" : "Saving"}
      </span>
    );
  }
  if (status === "extracted") {
    return (
      <span className="ab-chip ab-chip-accent" title="Extracted">
        <Check size={12} /> Extracted
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="ab-chip ab-chip-accent" title="Saved">
        <Check size={12} /> Saved
      </span>
    );
  }
  return (
    <span
      className="ab-chip"
      title={error ?? status}
      style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}
    >
      <X size={12} /> {status === "extract_failed" ? "Extract failed" : "Save failed"}
    </span>
  );
}

export function BulkRowTable({
  rows,
  onToggleSelected,
  onEditField,
  onRemove,
  onRetryExtract,
  onRetrySave,
}: {
  rows: BulkRow[];
  onToggleSelected: (id: string) => void;
  onEditField: (id: string, field: keyof EditableFields, value: string) => void;
  onRemove: (id: string) => void;
  onRetryExtract: (id: string) => void;
  onRetrySave: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="ab-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#2a2a2e] text-left text-[12px] text-[#a0a0a5] uppercase tracking-wider">
              <th className="px-3 py-2 w-[40px]"></th>
              <th className="px-3 py-2 w-[40px]"></th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Bank</th>
              <th className="px-3 py-2">FD #</th>
              <th className="px-3 py-2 text-right">Principal</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">Maturity</th>
              <th className="px-3 py-2 w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expanded.has(row.id);
              const canEdit =
                row.status === "extracted" ||
                row.status === "save_failed" ||
                row.status === "extract_failed";
              const canSelect =
                row.status === "extracted" || row.status === "save_failed";
              const f = row.edited;
              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b border-[#2a2a2e] hover:bg-[#17171a]/50",
                      row.isDuplicate && "bg-[#2a1f0d]/30",
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#2a2a2e]"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                        disabled={!canEdit}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => onToggleSelected(row.id)}
                        disabled={!canSelect}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={row.status} error={row.error} />
                        {row.isDuplicate && (
                          <span
                            className="ab-chip"
                            title="An FD with this bank + FD number already exists"
                            style={{ background: "#2a1f0d", color: "#f5a524", borderColor: "#3a2d0f" }}
                          >
                            <AlertTriangle size={12} /> Duplicate
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#a0a0a5] max-w-[180px]">
                      <div className="flex items-center gap-1.5 truncate">
                        {row.kind === "pdf" ? <FileText size={12} /> : <ImageIcon size={12} />}
                        <span className="truncate" title={row.file.name}>{row.file.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{f.bankName ?? ""}</td>
                    <td className="px-3 py-2 text-[#a0a0a5]">{f.fdNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right mono">{f.principal ?? ""}</td>
                    <td className="px-3 py-2 text-right mono">{f.interestRate ?? ""}</td>
                    <td className="px-3 py-2 mono text-[#a0a0a5]">{f.startDate ?? ""}</td>
                    <td className="px-3 py-2 mono text-[#a0a0a5]">{f.maturityDate ?? ""}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {row.status === "extract_failed" && (
                          <button
                            type="button"
                            onClick={() => onRetryExtract(row.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                            title="Retry extraction"
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                        {row.status === "save_failed" && (
                          <button
                            type="button"
                            onClick={() => onRetrySave(row.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                            title="Retry save"
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemove(row.id)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && canEdit && (
                    <tr className="border-b border-[#2a2a2e] bg-[#0e0e10]">
                      <td colSpan={11} className="px-6 py-4">
                        <BulkRowEditor
                          row={row}
                          onEditField={(field, value) => onEditField(row.id, field, value)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-row-table.tsx
git commit -m "feat(fd-bulk): add review table component"
```

---

### Task 10: Form — drop handling, extract phase, duplicate check

**Files:**
- Create: `src/app/dashboard/fd/bulk/bulk-upload-form.tsx`

Note: the save phase (`handleSaveSelected`, `handleRetrySave`) is stubbed here and completed in Task 11. We keep a `rowsRef` in sync with `state.rows` so async handlers read fresh row data without stale closures.

- [ ] **Step 1: Create the form**

Write `src/app/dashboard/fd/bulk/bulk-upload-form.tsx` with exactly this content:

```tsx
"use client";

import { useReducer, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { bulkReducer, initialState } from "./bulk-state";
import type { BulkRow, EditableFields, FdExtracted } from "./bulk-state";
import { BulkDropZone, MAX_FILES, MAX_FILE_SIZE, MAX_ZIP_SIZE } from "./bulk-drop-zone";
import { BulkRowTable } from "./bulk-row-table";
import { expandZip, isZipFile } from "@/lib/zip";
import { runWithConcurrency } from "@/lib/bulk-queue";

const CONCURRENCY = 5;
const SUPPORTED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function fileKind(file: File): "pdf" | "image" {
  return file.type === "application/pdf" ? "pdf" : "image";
}

function extensionMime(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function normalizeMime(file: File): File {
  if (SUPPORTED_MIMES.has(file.type)) return file;
  const inferred = extensionMime(file.name);
  if (inferred) return new File([file], file.name, { type: inferred });
  return file;
}

export function BulkUploadForm() {
  const [state, dispatch] = useReducer(bulkReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const rowsRef = useRef<BulkRow[]>([]);
  const router = useRouter();

  // Keep rowsRef in sync so async handlers read fresh state.
  useEffect(() => {
    rowsRef.current = state.rows;
  }, [state.rows]);

  const inFlight = state.rows.some(
    (r) => r.status === "extracting" || r.status === "saving",
  );

  useEffect(() => {
    if (!inFlight) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inFlight]);

  async function extractOne(row: BulkRow, signal: AbortSignal): Promise<FdExtracted> {
    const data = new FormData();
    if (row.kind === "pdf") data.append("pdfFile", row.file);
    else data.append("front", row.file);

    const res = await fetch("/api/fd/extract", {
      method: "POST",
      body: data,
      signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Extraction failed");
    return json.extracted as FdExtracted;
  }

  async function extractRows(rows: BulkRow[]) {
    if (rows.length === 0) return;
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    const signal = abortRef.current.signal;

    const extracted: Array<{ rowId: string; data: FdExtracted }> = [];

    await runWithConcurrency(
      rows,
      CONCURRENCY,
      async (row) => {
        dispatch({ type: "SET_STATUS", id: row.id, status: "extracting" });
        try {
          const data = await extractOne(row, signal);
          dispatch({ type: "SET_EXTRACTED", id: row.id, extracted: data });
          dispatch({ type: "SET_STATUS", id: row.id, status: "extracted" });
          extracted.push({ rowId: row.id, data });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Extraction failed";
          dispatch({ type: "SET_STATUS", id: row.id, status: "extract_failed", error: msg });
        }
      },
      signal,
    );

    await runDuplicateCheckFor(extracted);
  }

  async function runDuplicateCheckFor(
    items: Array<{ rowId: string; data: FdExtracted }>,
  ) {
    const keys = items
      .map((it) => ({
        bankName: it.data.bankName ?? "",
        fdNumber: it.data.fdNumber ?? "",
      }))
      .filter((k) => k.bankName && k.fdNumber);

    if (keys.length === 0) return;
    const param = keys.map((k) => `${k.bankName}|${k.fdNumber}`).join(",");
    try {
      const res = await fetch(`/api/fd/duplicates?keys=${encodeURIComponent(param)}`);
      if (!res.ok) return;
      const json = await res.json();
      dispatch({ type: "SET_DUPLICATES", keys: json.duplicates ?? [] });
    } catch {
      // non-fatal
    }
  }

  const handleFiles = useCallback(
    async (dropped: File[]) => {
      const allFiles: File[] = [];
      const messages: string[] = [];

      for (const f of dropped) {
        if (isZipFile(f)) {
          if (f.size > MAX_ZIP_SIZE) {
            messages.push(`${f.name} exceeds ${MAX_ZIP_SIZE / 1024 / 1024} MB zip limit`);
            continue;
          }
          try {
            const inner = await expandZip(f);
            if (inner.length === 0) {
              messages.push(`No supported files found in ${f.name}`);
              continue;
            }
            allFiles.push(...inner);
          } catch {
            messages.push(`Could not read zip: ${f.name}`);
          }
        } else {
          allFiles.push(f);
        }
      }

      const normalized = allFiles.map(normalizeMime);
      const supported = normalized.filter((f) => SUPPORTED_MIMES.has(f.type));

      const existing = new Set(
        rowsRef.current.map((r) => `${r.file.name}|${r.file.size}`),
      );
      const seen = new Set<string>(existing);
      const deduped: File[] = [];
      let duplicateCount = 0;
      for (const f of supported) {
        const key = `${f.name}|${f.size}`;
        if (seen.has(key)) {
          duplicateCount++;
          continue;
        }
        seen.add(key);
        deduped.push(f);
      }

      const tooLarge = deduped.filter((f) => f.size > MAX_FILE_SIZE);
      const sized = deduped.filter((f) => f.size <= MAX_FILE_SIZE);

      const remaining = MAX_FILES - rowsRef.current.length;
      const accepted = sized.slice(0, Math.max(0, remaining));
      const overCap = sized.length - accepted.length;

      if (accepted.length > 0) {
        const rows: BulkRow[] = accepted.map((file) => ({
          id: newId(),
          file,
          kind: fileKind(file),
          status: "pending",
          selected: true,
          edited: {},
        }));
        dispatch({ type: "ADD_ROWS", rows });
        // Allow the dispatch to flush and rowsRef to be updated by effect
        queueMicrotask(() => extractRows(rows));
      }

      if (duplicateCount) messages.push(`${duplicateCount} duplicate file${duplicateCount === 1 ? "" : "s"} skipped`);
      if (tooLarge.length) messages.push(`${tooLarge.length} file${tooLarge.length === 1 ? "" : "s"} exceeded 5 MB`);
      if (overCap > 0) messages.push(`${overCap} file${overCap === 1 ? "" : "s"} skipped (20-file cap reached)`);
      if (messages.length) alert(messages.join("\n"));
    },
    // extractRows/runDuplicateCheckFor are defined in this component and close over
    // dispatch (stable) + rowsRef (ref, stable). No dependencies needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function handleRetryExtract(id: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    extractRows([row]);
  }

  function handleRetrySave(id: string) {
    // Filled in Task 11
    void id;
  }

  function handleCancelAll() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function handleRemove(id: string) {
    dispatch({ type: "REMOVE_ROW", id });
  }

  function handleToggleSelected(id: string) {
    dispatch({ type: "TOGGLE_SELECTED", id });
  }

  function handleEditField(id: string, field: keyof EditableFields, value: string) {
    dispatch({ type: "EDIT_FIELD", id, field, value });
  }

  function handleReset() {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "RESET" });
  }

  const selectedSavable = state.rows.filter(
    (r) => r.selected && (r.status === "extracted" || r.status === "save_failed"),
  );

  async function handleSaveSelected() {
    // Filled in Task 11
    alert(`Would save ${selectedSavable.length} rows (Task 11)`);
  }

  const counts = {
    total: state.rows.length,
    saved: state.rows.filter((r) => r.status === "saved").length,
    failedSave: state.rows.filter((r) => r.status === "save_failed").length,
    failedExtract: state.rows.filter((r) => r.status === "extract_failed").length,
  };
  void router;

  return (
    <div className="space-y-6 pb-24">
      {state.rows.length < MAX_FILES && (
        <BulkDropZone
          currentCount={state.rows.length}
          onFiles={handleFiles}
          disabled={inFlight}
        />
      )}

      {state.rows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-[13px] text-[#a0a0a5]">
              Files ({counts.total} / {MAX_FILES})
              {counts.saved > 0 && <> · {counts.saved} saved</>}
              {counts.failedSave > 0 && <> · {counts.failedSave} failed to save</>}
              {counts.failedExtract > 0 && <> · {counts.failedExtract} failed to extract</>}
            </p>
            <div className="flex items-center gap-2">
              {inFlight && (
                <button
                  type="button"
                  onClick={handleCancelAll}
                  className="ab-btn ab-btn-ghost"
                  style={{ fontSize: "13px" }}
                >
                  Cancel all
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="ab-btn ab-btn-ghost"
                style={{ fontSize: "13px" }}
                disabled={inFlight}
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>
          </div>

          <BulkRowTable
            rows={state.rows}
            onToggleSelected={handleToggleSelected}
            onEditField={handleEditField}
            onRemove={handleRemove}
            onRetryExtract={handleRetryExtract}
            onRetrySave={handleRetrySave}
          />
        </>
      )}

      {state.rows.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-[#0e0e10]/95 backdrop-blur border-t border-[#2a2a2e]">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSaveSelected}
              disabled={selectedSavable.length === 0 || inFlight}
              className="ab-btn ab-btn-accent"
            >
              {inFlight && selectedSavable.some((r) => r.status === "saving") ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                <>Save selected ({selectedSavable.length})</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verify — extract phase end-to-end**

1. Start dev server: `npm run dev`
2. Log in, then navigate manually to `/dashboard/fd/bulk`.
3. Drop 2-3 FD PDFs or images.
4. Expected: rows appear with status `Pending → Extracting → Extracted`. Essential columns (Bank, FD #, Principal, Rate, dates) populate as extractions complete.
5. Expand a row → editor fields are pre-filled and editable.
6. Drop a zip of 3 files mixed with 1 unsupported file → 3 rows appear, unsupported silently ignored.
7. Drop more than 20 files total → alert warns about over-cap count.
8. Existing FD matching (bank + fdNumber) of any extracted row → orange "Duplicate" badge appears after extracts settle.
9. DevTools Network tab while dropping 10 files → never more than 5 in-flight `/api/fd/extract` requests.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-upload-form.tsx
git commit -m "feat(fd-bulk): drop, extract, and duplicate-check flow"
```

---

### Task 11: Save phase

**Files:**
- Modify: `src/app/dashboard/fd/bulk/bulk-upload-form.tsx`

- [ ] **Step 1: Add `mergedFields` to the imports**

Find in `bulk-upload-form.tsx`:

```tsx
import { bulkReducer, initialState } from "./bulk-state";
```

Replace with:

```tsx
import { bulkReducer, initialState, mergedFields } from "./bulk-state";
```

- [ ] **Step 2: Replace `handleRetrySave` stub**

Find:

```tsx
  function handleRetrySave(id: string) {
    // Filled in Task 11
    void id;
  }
```

Replace with:

```tsx
  function handleRetrySave(id: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    saveRows([row]);
  }
```

- [ ] **Step 3: Replace `handleSaveSelected` stub**

Find:

```tsx
  async function handleSaveSelected() {
    // Filled in Task 11
    alert(`Would save ${selectedSavable.length} rows (Task 11)`);
  }
```

Replace with:

```tsx
  async function handleSaveSelected() {
    if (selectedSavable.length === 0) return;
    await saveRows(selectedSavable);
  }
```

- [ ] **Step 4: Add `saveRows` and helpers above the `selectedSavable` line**

Insert this block immediately above `const selectedSavable = state.rows.filter(`:

```tsx
  async function uploadOneFile(file: File, signal: AbortSignal): Promise<string> {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/fd/upload", { method: "POST", body: data, signal });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
    return json.url as string;
  }

  async function createOneFd(
    row: BulkRow,
    url: string,
    signal: AbortSignal,
  ): Promise<void> {
    const f = mergedFields(row);
    const body: Record<string, unknown> = {
      bankName: f.bankName,
      fdNumber: f.fdNumber || null,
      accountNumber: f.accountNumber || null,
      principal: parseFloat(f.principal),
      interestRate: parseFloat(f.interestRate),
      tenureMonths: parseInt(f.tenureMonths || "0") || 0,
      tenureDays: parseInt(f.tenureDays || "0") || 0,
      tenureText: f.tenureText || null,
      startDate: f.startDate,
      maturityDate: f.maturityDate,
      maturityAmount: f.maturityAmount ? parseFloat(f.maturityAmount) : null,
      interestType: f.interestType || "compound",
      compoundFreq: f.compoundFreq || "quarterly",
      maturityInstruction: f.maturityInstruction || null,
      payoutFrequency: f.payoutFrequency || null,
      nomineeName: f.nomineeName || null,
      nomineeRelation: f.nomineeRelation || null,
      notes: null,
      sourceImageUrl: row.kind === "image" ? url : null,
      sourceImageBackUrl: null,
      sourcePdfUrl: row.kind === "pdf" ? url : null,
    };
    const res = await fetch("/api/fd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Save failed");
  }

  async function saveRows(rows: BulkRow[]) {
    if (rows.length === 0) return;
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    const signal = abortRef.current.signal;

    await runWithConcurrency(
      rows,
      CONCURRENCY,
      async (row) => {
        dispatch({ type: "SET_STATUS", id: row.id, status: "saving" });
        try {
          const url = await uploadOneFile(row.file, signal);
          // Re-read the latest row state to pick up edits made after queueing
          const latest = rowsRef.current.find((r) => r.id === row.id) ?? row;
          await createOneFd(latest, url, signal);
          dispatch({ type: "SET_STATUS", id: row.id, status: "saved" });
          dispatch({ type: "SET_SELECTED", id: row.id, selected: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Save failed";
          dispatch({ type: "SET_STATUS", id: row.id, status: "save_failed", error: msg });
        }
      },
      signal,
    );

    router.refresh();
  }
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual verify — save flow**

1. `npm run dev`, navigate to `/dashboard/fd/bulk`.
2. Drop 3 valid FD images or PDFs; wait for extraction.
3. Click "Save selected (3)".
4. Expected: status transitions `Extracted → Saving → Saved` per row. Selection checkbox auto-unchecks after save. Counter shows "3 saved".
5. Navigate to `/dashboard/fd` — 3 new FDs appear in the list.
6. Open one — `sourceImageUrl` or `sourcePdfUrl` points to a served file that loads correctly.
7. Force a failure: expand one row, clear the bank name field, click Save again for the remaining rows, confirm that row ends in `save_failed` with the server's validation message. Fix the bank name and click its retry icon → row saves.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/fd/bulk/bulk-upload-form.tsx
git commit -m "feat(fd-bulk): implement save phase with per-row retry"
```

---

### Task 12: "Bulk Upload" entry point on FD list

**Files:**
- Modify: `src/app/dashboard/fd/page.tsx`

- [ ] **Step 1: Import `Upload` icon**

In `src/app/dashboard/fd/page.tsx`, change the existing import:

```tsx
import { Plus } from "lucide-react";
```

to:

```tsx
import { Plus, Upload } from "lucide-react";
```

- [ ] **Step 2: Add the Bulk Upload button next to Add FD**

Find this block:

```tsx
        <Link
          href="/dashboard/fd/new"
          className="ab-btn ab-btn-accent"
        >
          <Plus size={15} />
          Add FD
        </Link>
```

Replace with:

```tsx
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/fd/bulk"
            className="ab-btn ab-btn-ghost border border-[#2a2a2e]"
          >
            <Upload size={15} />
            Bulk Upload
          </Link>
          <Link
            href="/dashboard/fd/new"
            className="ab-btn ab-btn-accent"
          >
            <Plus size={15} />
            Add FD
          </Link>
        </div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verify**

1. `npm run dev`, visit `/dashboard/fd`.
2. The FD list page shows two buttons: "Bulk Upload" (secondary) and "Add FD" (primary).
3. Clicking "Bulk Upload" navigates to `/dashboard/fd/bulk`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/fd/page.tsx
git commit -m "feat(fd): add bulk upload entry point on FD list"
```

---

### Task 13: Final end-to-end verification

**Files:** none — verification only.

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Verification matrix**

Run `npm run dev` and go through the full checklist. Mark each:

- [ ] Drop 3 loose PDFs → all extract → save all → 3 FDs created, PDFs viewable via detail page link.
- [ ] Drop 3 loose images → all extract → save all → 3 FDs created, images viewable.
- [ ] Drop a zip containing 2 PDFs + 2 images + 1 `.txt` → 4 rows, `.txt` silently ignored.
- [ ] Drop zip + loose files together → all contribute rows.
- [ ] Drop 25 files → alert "5 files skipped (20-file cap reached)"; 20 rows created.
- [ ] Drop a file > 5 MB → alert "1 file exceeded 5 MB"; skipped.
- [ ] Drop a zip > 20 MB → alert about zip size; no rows.
- [ ] Drop a file whose (bank, fdNumber) matches an existing FD → duplicate badge appears after extract; save still works.
- [ ] Extract failure (e.g., corrupt PDF) → row → `extract_failed`; retry icon re-runs just that row.
- [ ] Save failure (clear bank name → save) → row → `save_failed`; edit and retry.
- [ ] Cancel-all during extract of a 10-file batch → in-flight rows stop making new requests; already-done rows remain.
- [ ] Navigate away while extracting → browser confirms "unsaved changes".
- [ ] Expand a row, edit principal, save → saved FD has edited principal (not the original extracted value).
- [ ] DevTools Network tab while dropping 15 files → never more than 5 in-flight `/api/fd/extract` calls at once.

- [ ] **Step 3: Final commit (only if any fix-ups needed during verification)**

If no fix-ups are needed, skip this step. Otherwise:

```bash
git add -A
git commit -m "fix(fd-bulk): verification pass adjustments"
```

---

## Verification commands summary

| Purpose | Command |
|---|---|
| Type check | `npx tsc --noEmit` |
| Build | `npm run build` |
| Dev server | `npm run dev` |

No automated test framework exists in this project — verification is manual via the dev server.
