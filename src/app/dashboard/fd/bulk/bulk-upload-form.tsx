"use client";

import { useReducer, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { bulkReducer, initialState, mergedFields } from "./bulk-state";
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
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    saveRows([row]);
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

  const selectedSavable = state.rows.filter(
    (r) => r.selected && (r.status === "extracted" || r.status === "save_failed"),
  );

  async function handleSaveSelected() {
    if (selectedSavable.length === 0) return;
    await saveRows(selectedSavable);
  }

  const counts = {
    total: state.rows.length,
    saved: state.rows.filter((r) => r.status === "saved").length,
    failedSave: state.rows.filter((r) => r.status === "save_failed").length,
    failedExtract: state.rows.filter((r) => r.status === "extract_failed").length,
  };
  return (
    <div className="space-y-6 pb-24">
      {state.rows.length < MAX_FILES && (
        <BulkDropZone
          currentCount={state.rows.length}
          onFiles={handleFiles}
          disabled={inFlight}
        />
      )}

      {counts.saved > 0 && !inFlight && (
        <div
          className="ab-card-flat flex items-center justify-between flex-wrap gap-3 px-4 py-3"
          style={{ background: "#0f2a19", color: "#5ee0a4", borderColor: "#1a3a24" }}
        >
          <div className="flex items-center gap-2 text-[13px]">
            <CheckCircle2 size={16} />
            <span className="font-semibold">
              {counts.saved} saved
            </span>
            {counts.failedSave > 0 && (
              <span className="text-[#ff7a6e]">· {counts.failedSave} failed to save</span>
            )}
            {counts.failedExtract > 0 && (
              <span className="text-[#ff7a6e]">· {counts.failedExtract} failed to extract</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="ab-btn ab-btn-ghost"
              style={{ fontSize: "13px" }}
            >
              Upload more
            </button>
            <Link href="/dashboard/fd" className="ab-btn ab-btn-accent" style={{ fontSize: "13px" }}>
              Go to FDs
            </Link>
          </div>
        </div>
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
