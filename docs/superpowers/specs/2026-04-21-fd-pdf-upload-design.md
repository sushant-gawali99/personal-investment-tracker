# FD PDF Upload Support

**Date:** 2026-04-21
**Status:** Approved

## Overview

Add PDF upload support to the Add FD form. Users can toggle between image mode (existing) and PDF mode (new). In PDF mode, a single PDF is uploaded, sent to Claude for AI extraction using its native document support, and stored on the local filesystem alongside existing certificate images.

## Goals

- Accept PDF uploads in the AI Digitize panel as an alternative to images
- Extract FD fields from PDFs using Claude's native document block (no image conversion)
- Store the PDF on the local filesystem and display a link on the FD detail page
- No changes to the existing image upload flow

## Architecture

### 1. UI — `src/app/dashboard/fd/new/fd-new-form.tsx`

Add an "Image / PDF" toggle at the top of the AI Digitize panel.

**Image mode** (default): existing front + back `ImageDropZone` components, unchanged.

**PDF mode**: single drop zone accepting `application/pdf` only. Reuses `ImageDropZone` with a different `accept` prop and label ("Drop FD certificate PDF here").

New state:
```ts
const [uploadMode, setUploadMode] = useState<"image" | "pdf">("image");
const [pdfFile, setPdfFile] = useState<File | null>(null);
```

Switching modes clears the other mode's files. The Extract button is enabled when either `frontFile` is set (image mode) or `pdfFile` is set (PDF mode).

On form submit, if `pdfFile` is set, upload it via `/api/fd/upload` and store the returned URL in the `sourcePdfUrl` field of the POST body.

### 2. Extract API — `src/app/api/fd/extract/route.ts`

Accept an optional `pdfFile` form field in addition to existing `frontFile` / `backFile`.

Branch on which field is present:

- **PDF path:** Convert `pdfFile` to base64, send to Claude as a `document` block:
  ```ts
  { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
  ```
  Same extraction prompt. Same response shape (`priorPeriods`, `renewalNumber`, all FD fields).

- **Image path:** Existing logic, unchanged.

Max file size: 5 MB (same as images). Response JSON format is unchanged.

### 3. Upload API — `src/app/api/fd/upload/route.ts`

Add `application/pdf` to the accepted MIME types list. Store with `.pdf` extension. Same random hex filename, same `UPLOAD_DIR` path. Return `{ url: "/api/fd/file/<filename>" }` for PDFs (different prefix from images).

### 4. New File Serve Route — `src/app/api/fd/file/[filename]/route.ts`

Mirrors `/api/fd/image/[filename]` but for PDFs:

- Filename regex: `/^[a-f0-9]+\.pdf$/`
- `Content-Type: application/pdf`
- `Cache-Control: public, max-age=31536000, immutable`
- Returns 404 if file not found

### 5. Schema — `prisma/schema.prisma`

Add one nullable field to `FixedDeposit`:

```prisma
sourcePdfUrl String?
```

Kept separate from `sourceImageUrl` / `sourceImageBackUrl` to avoid ambiguity. No data migration required (nullable, existing rows unaffected).

### 6. FD Detail Page — `src/app/dashboard/fd/[id]/page.tsx`

In the documents section, if `sourcePdfUrl` is set, render a "View PDF" link (opens in new tab) alongside any certificate images.

## Data Flow

**PDF upload path:**
1. User toggles to PDF mode, drops a PDF
2. Clicks Extract → form POSTs `pdfFile` to `/api/fd/extract`
3. Server sends PDF as document block to Claude → returns extracted JSON
4. Form pre-fills with extracted fields
5. On submit → PDF POSTed to `/api/fd/upload` → URL stored as `sourcePdfUrl` in FD record

**Image upload path:** unchanged.

## Out of Scope

- PDF rendering/preview inline (link only)
- Multi-file PDF uploads
- Object storage (S3/R2) — local filesystem only
- Changes to the renew FD form
