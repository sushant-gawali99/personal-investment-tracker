# FD PDF Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF upload support to the Add FD form — toggle between image and PDF mode, extract FD fields from PDFs via Claude's native document block, and store the PDF on the local filesystem.

**Architecture:** A new Image/PDF toggle in the AI Digitize panel switches the UI between the existing two image drop zones and a single PDF drop zone. The `/api/fd/extract` route branches on `pdfFile` vs `front` form fields; PDFs are sent as a `document` block to Claude. A new `/api/fd/file/[filename]` route serves stored PDFs; the upload route is extended to accept `application/pdf`.

**Tech Stack:** Next.js App Router (server + client components), Prisma + LibSQL, Anthropic SDK (`DocumentBlockParam`), react-dropzone, Lucide icons.

---

### Task 1: Add `sourcePdfUrl` to schema and wire it into the create API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/fd/route.ts`

- [ ] **Step 1: Add field to schema**

In `prisma/schema.prisma`, add one line after `sourceImageBackUrl`:

```prisma
sourceImageBackUrl String?
sourcePdfUrl       String?
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/sushantgawali/Documents/Projects/personal-investment-tracker
npx prisma migrate dev --name add_source_pdf_url
```

Expected output: `✔ Generated Prisma Client` and migration applied with no errors.

- [ ] **Step 3: Accept `sourcePdfUrl` in the FD create route**

In `src/app/api/fd/route.ts`, destructure `sourcePdfUrl` from the body alongside the other fields (line 28):

```ts
    notes, sourceImageUrl, sourceImageBackUrl, sourcePdfUrl,
    renewals,
```

Then pass it into `tx.fixedDeposit.create` data (after `sourceImageBackUrl: sourceImageBackUrl || null,`):

```ts
        sourceImageBackUrl: sourceImageBackUrl || null,
        sourcePdfUrl: sourcePdfUrl || null,
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/app/api/fd/route.ts
git commit -m "feat: add sourcePdfUrl field to FixedDeposit schema"
```

---

### Task 2: Create the PDF file serve route

**Files:**
- Create: `src/app/api/fd/file/[filename]/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/fd/file/[filename]/route.ts` with this content:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "fd");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!/^[a-f0-9]+\.pdf$/.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(join(UPLOAD_DIR, filename));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fd/file
git commit -m "feat: add PDF file serve route at /api/fd/file/[filename]"
```

---

### Task 3: Extend the upload API to accept PDFs

**Files:**
- Modify: `src/app/api/fd/upload/route.ts`

- [ ] **Step 1: Add PDF support**

Replace the entire content of `src/app/api/fd/upload/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 5 MB" }, { status: 400 });
  if (!VALID_TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "bin");
  const name = `${randomBytes(10).toString("hex")}.${ext}`;
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "fd");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);

  const url = ext === "pdf" ? `/api/fd/file/${name}` : `/api/fd/image/${name}`;
  return NextResponse.json({ url });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fd/upload/route.ts
git commit -m "feat: extend upload API to accept PDFs, serve via /api/fd/file/"
```

---

### Task 4: Extend the extract API to handle PDFs

**Files:**
- Modify: `src/app/api/fd/extract/route.ts`

- [ ] **Step 1: Add PDF extraction branch**

Replace the entire content of `src/app/api/fd/extract/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import type { ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { DocumentBlockParam } from "@anthropic-ai/sdk/resources/messages";

const PROMPT = `These images show the front and back of a Fixed Deposit certificate/receipt. Extract all FD details and return a single JSON object with exactly these fields (use null for any field not found):

{
  "bankName": string,
  "fdNumber": string | null,
  "accountNumber": string | null,
  "principal": number,
  "interestRate": number,
  "tenureMonths": number,
  "startDate": "YYYY-MM-DD",
  "maturityDate": "YYYY-MM-DD",
  "maturityAmount": number | null,
  "interestType": "simple" | "compound",
  "compoundFreq": "monthly" | "quarterly" | "annually" | null,
  "maturityInstruction": "renew_principal_interest" | "renew_principal" | "payout" | null,
  "payoutFrequency": "on_maturity" | "monthly" | "quarterly" | "half_yearly" | "annually" | null,
  "nomineeName": string | null,
  "nomineeRelation": string | null,
  "renewalNumber": number | null,
  "priorPeriods": Array<{ "startDate": "YYYY-MM-DD" | null, "maturityDate": "YYYY-MM-DD" | null, "principal": number | null, "interestRate": number | null, "tenureMonths": number | null, "maturityAmount": number | null }> | null
}

Rules:
- interestRate must be per annum percentage (e.g. 7.5 not 0.075)
- tenureMonths must be an integer (convert years to months if needed)
- dates must be in YYYY-MM-DD format
- If compounding frequency is not mentioned, default to "quarterly" for compound type
- maturityInstruction: "renew_principal_interest" = auto-renew with interest; "renew_principal" = auto-renew principal, payout interest; "payout" = credit to savings on maturity
- payoutFrequency: how interest is paid out. "on_maturity" for cumulative/reinvest FDs; monthly/quarterly/etc for non-cumulative payouts
- Renewal details and nominee are usually printed or handwritten on the back side of the receipt — look carefully for handwritten annotations, checkboxes, stamps, or pen-filled fields
- Even if text is handwritten, faded, or partially legible, make your best effort to extract it

IMPORTANT — current-period fields:
- principal, interestRate, tenureMonths, startDate, maturityDate must describe the CURRENT (latest / most recent) active period of this FD
- If the back side shows a renewal table with entries (handwritten or printed), the LATEST renewal row is the current period — use its date of renewal as startDate, its due date as maturityDate, its period/amount/rate as tenureMonths/principal/interestRate
- Only if NO renewal has occurred, use the original opening date, original maturity date, and original amount/rate from the front side

renewalNumber — count of COMPLETED renewals only:
- 0 or null = this FD has never been renewed (only the original period exists)
- 1 = renewed ONCE (one entry in the renewal table)
- 2 = renewed twice (two entries in the renewal table)
- Do NOT count the original opening as a renewal. Count ONLY filled rows in the "Details of Renewal" / renewal table on the back. Tally marks, handwritten rows, or stamped entries each count as one renewal

priorPeriods — historical periods before the current one, in chronological order:
- If renewalNumber > 0, populate priorPeriods with exactly renewalNumber entries
- priorPeriods[0] = the ORIGINAL period from the front of the receipt (opening date → original maturity date, original amount/rate/tenure)
- priorPeriods[1..N-1] = intermediate renewals from the back-side renewal table, EXCLUDING the latest one (the latest is already captured in the top-level current-period fields)
- Example: if renewalNumber=1, priorPeriods has 1 entry = original. The single renewal row is the current period, captured at the top level.
- Example: if renewalNumber=2, priorPeriods has 2 entries = [original, first renewal]. The second (latest) renewal row is the current period.
- If renewalNumber is 0 or null, set priorPeriods to null
- Return ONLY the JSON, no explanation`;

const PROMPT_SINGLE = PROMPT.replace("These images show the front and back of a Fixed Deposit certificate/receipt.", "This image shows a Fixed Deposit certificate/receipt.");

const PROMPT_PDF = PROMPT.replace("These images show the front and back of a Fixed Deposit certificate/receipt.", "This PDF is a Fixed Deposit certificate/receipt.");

async function fileToImageBlock(file: File): Promise<ImageBlockParam> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: base64,
    },
  };
}

async function fileToPdfBlock(file: File): Promise<DocumentBlockParam> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: base64,
    },
  };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const pdfFile = formData.get("pdfFile") as File | null;
  const front = formData.get("front") as File | null;
  const back = formData.get("back") as File | null;

  if (!pdfFile && !front) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    let contentBlocks: (ImageBlockParam | TextBlockParam | DocumentBlockParam)[];

    if (pdfFile) {
      if (pdfFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: `${pdfFile.name} exceeds 5 MB limit.` }, { status: 400 });
      }
      if (pdfFile.type !== "application/pdf") {
        return NextResponse.json({ error: "Expected a PDF file." }, { status: 400 });
      }
      contentBlocks = [
        await fileToPdfBlock(pdfFile),
        { type: "text", text: PROMPT_PDF },
      ];
    } else {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      for (const file of [front, back].filter(Boolean) as File[]) {
        if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: `${file.name} exceeds 5 MB limit.` }, { status: 400 });
        if (!validTypes.includes(file.type)) return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, or WebP." }, { status: 400 });
      }
      contentBlocks = [];
      contentBlocks.push(await fileToImageBlock(front!));
      if (back) contentBlocks.push(await fileToImageBlock(back));
      contentBlocks.push({ type: "text", text: back ? PROMPT : PROMPT_SINGLE });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract details from document." }, { status: 422 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted });
  } catch (err) {
    console.error("Claude extraction failed:", err);
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `DocumentBlockParam` import fails (older SDK), use the inline type:
```ts
type DocumentBlockParam = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fd/extract/route.ts
git commit -m "feat: extend extract API to support PDF via Claude document block"
```

---

### Task 5: Add Image/PDF toggle and PDF drop zone to the Add FD form

**Files:**
- Modify: `src/app/dashboard/fd/new/fd-new-form.tsx`

- [ ] **Step 1: Add `PdfDropZone` component**

After the closing brace of the `ImageDropZone` function (after line 172) and before the `type PriorRenewal` line, insert this new component:

```tsx
function PdfDropZone({
  file, onFile, onClear, disabled,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const onDrop = useCallback((files: File[]) => { if (files[0]) onFile(files[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [] },
    maxFiles: 1,
    disabled,
  });

  if (file) {
    return (
      <div className="rounded-xl border border-[#2a2a2e] px-4 py-3 flex items-center justify-between bg-[#17171a]">
        <div className="flex items-center gap-2 text-[13px] text-[#ededed] truncate">
          <Upload size={14} className="text-[#a0a0a5] shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="text-[#a0a0a5] shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="ml-3 w-7 h-7 rounded-full flex items-center justify-center text-[#a0a0a5] hover:bg-[#2a2a2e] transition-colors shrink-0"
          aria-label="Remove PDF"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors bg-[#17171a]",
        isDragActive
          ? "border-[#ff385c] bg-[#2a1218]"
          : "border-[#3a3a3f] hover:border-[#ff385c] hover:bg-[#2a1218]",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <input {...getInputProps()} />
      <Upload size={18} className="mx-auto mb-2 text-[#a0a0a5]" />
      <p className="text-[13px] text-[#a0a0a5]">
        {isDragActive ? "Drop PDF here" : "Click or drag — PDF only, max 5 MB"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Add `uploadMode` and `pdfFile` state**

In `FDNewForm`, after the `priorRenewals` state line (line 201), add:

```ts
  const [uploadMode, setUploadMode] = useState<"image" | "pdf">("image");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
```

- [ ] **Step 3: Add `handlePdfFile` and `clearPdf` handlers**

After the `clearBack` function (line 216), add:

```ts
  function handlePdfFile(file: File) {
    setPdfFile(file);
    setExtracted(false);
    setExtractError("");
  }
  function clearPdf() { setPdfFile(null); setExtracted(false); }
```

- [ ] **Step 4: Update `handleExtract` to support PDF mode**

Replace the existing `handleExtract` function body with:

```ts
  async function handleExtract() {
    if (uploadMode === "pdf" && !pdfFile) return;
    if (uploadMode === "image" && !frontFile) return;
    setExtracting(true);
    setExtractError("");
    const data = new FormData();
    if (uploadMode === "pdf") {
      data.append("pdfFile", pdfFile!);
    } else {
      data.append("front", frontFile!);
      if (backFile) data.append("back", backFile);
    }

    try {
      const res = await fetch("/api/fd/extract", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) { setExtractError(json.error ?? "Extraction failed."); return; }
      const e = json.extracted;
      setForm({
        bankName: e.bankName ?? "",
        fdNumber: e.fdNumber ?? "",
        accountNumber: e.accountNumber ?? "",
        principal: e.principal?.toString() ?? "",
        interestRate: e.interestRate?.toString() ?? "",
        tenureMonths: e.tenureMonths?.toString() ?? "",
        startDate: toDateInput(e.startDate),
        maturityDate: toDateInput(e.maturityDate),
        maturityAmount: e.maturityAmount?.toString() ?? "",
        interestType: e.interestType ?? "compound",
        compoundFreq: e.compoundFreq ?? "quarterly",
        maturityInstruction: e.maturityInstruction ?? "",
        payoutFrequency: e.payoutFrequency ?? "",
        nomineeName: e.nomineeName ?? "",
        nomineeRelation: e.nomineeRelation ?? "",
        notes: "",
      });
      const rn = e.renewalNumber ?? null;
      setRenewalNumber(rn);
      if (rn && rn > 0) {
        const aiPriors = Array.isArray(e.priorPeriods) ? e.priorPeriods : [];
        setPriorRenewals(
          Array.from({ length: rn }, (_, i) => {
            const p = aiPriors[i];
            if (!p) return emptyPrior();
            return {
              startDate: toDateInput(p.startDate),
              maturityDate: toDateInput(p.maturityDate),
              principal: p.principal != null ? p.principal.toString() : "",
              interestRate: p.interestRate != null ? p.interestRate.toString() : "",
              tenureMonths: p.tenureMonths != null ? p.tenureMonths.toString() : "",
              maturityAmount: p.maturityAmount != null ? p.maturityAmount.toString() : "",
            };
          })
        );
      }
      setExtracted(true);
    } catch {
      setExtractError("Extraction failed. Please fill in manually.");
    } finally {
      setExtracting(false);
    }
  }
```

- [ ] **Step 5: Update `handleSubmit` to upload PDF and pass `sourcePdfUrl`**

Replace lines 290–293 (the `Promise.all` upload block) with:

```ts
      let sourceImageUrl: string | null = null;
      let sourceImageBackUrl: string | null = null;
      let sourcePdfUrl: string | null = null;

      if (uploadMode === "pdf" && pdfFile) {
        sourcePdfUrl = await uploadFile(pdfFile);
      } else {
        [sourceImageUrl, sourceImageBackUrl] = await Promise.all([
          frontFile ? uploadFile(frontFile) : Promise.resolve(null),
          backFile ? uploadFile(backFile) : Promise.resolve(null),
        ]);
      }
```

Then in the `fetch("/api/fd", ...)` body, add `sourcePdfUrl` alongside the existing fields:

```ts
          sourceImageUrl,
          sourceImageBackUrl,
          sourcePdfUrl,
```

- [ ] **Step 6: Replace the AI Digitize panel JSX with the toggle + conditional drop zones**

Replace the inner content of the AI Digitize panel section — from the `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` block (line 382) up to and including its closing `</div>` (line 397) — with:

```tsx
        {/* Image / PDF mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-[#17171a] w-fit">
          {(["image", "pdf"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (mode === uploadMode) return;
                setUploadMode(mode);
                if (mode === "pdf") { setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null); }
                else { setPdfFile(null); }
                setExtracted(false);
                setExtractError("");
              }}
              className={cn(
                "px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                uploadMode === mode
                  ? "bg-[#2a2a2e] text-[#ededed]"
                  : "text-[#a0a0a5] hover:text-[#ededed]"
              )}
            >
              {mode === "image" ? "Image" : "PDF"}
            </button>
          ))}
        </div>

        {uploadMode === "image" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageDropZone
              label="Front side *"
              hint="Click or drag - JPEG, PNG, WebP"
              file={frontFile} preview={frontPreview}
              onFile={handleFrontFile} onClear={clearFront}
              disabled={extracting}
            />
            <ImageDropZone
              label="Back side (optional)"
              hint="Upload for more details"
              file={backFile} preview={backPreview}
              onFile={handleBackFile} onClear={clearBack}
              disabled={extracting || !frontFile}
            />
          </div>
        ) : (
          <div>
            <p className="ab-label mb-2">FD Certificate PDF *</p>
            <PdfDropZone
              file={pdfFile}
              onFile={handlePdfFile}
              onClear={clearPdf}
              disabled={extracting}
            />
          </div>
        )}
```

- [ ] **Step 7: Update the Extract button condition**

The existing Extract button shows when `frontFile && !extracted`. Update it to also show for PDF mode (line ~408):

Replace:
```tsx
        {frontFile && !extracted && (
```
With:
```tsx
        {((uploadMode === "image" && frontFile) || (uploadMode === "pdf" && pdfFile)) && !extracted && (
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/fd/new/fd-new-form.tsx
git commit -m "feat: add Image/PDF toggle and PDF drop zone to Add FD form"
```

---

### Task 6: Show PDF link on the FD detail page

**Files:**
- Modify: `src/app/dashboard/fd/[id]/page.tsx`

- [ ] **Step 1: Update the data fetch to include `sourcePdfUrl`**

Prisma will return `sourcePdfUrl` automatically since it's in the schema. No query change needed — it's already selected via the default `findUnique`. Verify by checking the `fd` object used in the component includes `sourcePdfUrl`.

- [ ] **Step 2: Update the Source Document section**

In `src/app/dashboard/fd/[id]/page.tsx`, find the Source Document section (around line 238). Replace the condition `fd.sourceImageUrl || fd.sourceImageBackUrl` and the block inside it with:

```tsx
          <div className="ab-card p-6">
            <h2 className="text-[16px] font-semibold text-[#ededed] mb-4 tracking-tight">Source Document</h2>
            {fd.sourcePdfUrl ? (
              <a
                href={fd.sourcePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-[#ededed] font-semibold underline underline-offset-4 hover:text-[#ff385c] transition-colors"
              >
                <FileText size={14} /> View PDF
              </a>
            ) : fd.sourceImageUrl || fd.sourceImageBackUrl ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { url: fd.sourceImageUrl, label: "Front" },
                  { url: fd.sourceImageBackUrl, label: "Back" },
                ].filter((s) => s.url).map(({ url, label }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">{label}</p>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#ededed] font-semibold underline underline-offset-4 inline-flex items-center gap-1 hover:text-[#ff385c] transition-colors">
                        <FileText size={11} /> Open
                      </a>
                    </div>
                    <a href={url!} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url!} alt={`FD certificate ${label}`} className="rounded-xl w-full h-44 object-contain bg-[#1c1c20] border border-[#2a2a2e]" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#a0a0a5]">No document was attached when this FD was added.</p>
            )}
          </div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/fd/[id]/page.tsx
git commit -m "feat: show PDF link in FD detail Source Document section"
```

---

### Task 7: Build verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about image optimization are acceptable.

- [ ] **Step 2: Commit if any build-time fixes were needed**

If the build surfaced type or lint errors not caught by `tsc --noEmit`, fix and commit:

```bash
git add -p
git commit -m "fix: resolve build-time errors from PDF upload feature"
```
