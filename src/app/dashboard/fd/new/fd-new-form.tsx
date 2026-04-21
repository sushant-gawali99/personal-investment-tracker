"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, Sparkles, ChevronDown, ChevronUp, X, Camera, RefreshCw } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

function CameraModal({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera access denied or unavailable."));
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function capture() {
    if (!videoRef.current) return;
    setCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onClose();
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ab-card overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2e]">
          <p className="text-[16px] font-semibold text-[#ededed] tracking-tight">Take Photo</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#a0a0a5] hover:bg-[#1c1c20] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error ? (
            <p className="ab-card-flat text-[13px] px-3 py-2" style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}>{error}</p>
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl aspect-[4/3] bg-black object-cover" />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={capture}
              disabled={!!error || capturing}
              className="ab-btn ab-btn-accent flex-1"
            >
              <Camera size={14} /> Capture
            </button>
            <button type="button" onClick={onClose} className="ab-btn ab-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FDForm {
  bankName: string; fdNumber: string; accountNumber: string;
  principal: string; interestRate: string; tenureMonths: string;
  startDate: string; maturityDate: string; maturityAmount: string;
  interestType: string; compoundFreq: string;
  maturityInstruction: string; payoutFrequency: string;
  nomineeName: string; nomineeRelation: string;
  notes: string;
}

const empty: FDForm = {
  bankName: "", fdNumber: "", accountNumber: "",
  principal: "", interestRate: "", tenureMonths: "",
  startDate: "", maturityDate: "", maturityAmount: "",
  interestType: "compound", compoundFreq: "quarterly",
  maturityInstruction: "", payoutFrequency: "",
  nomineeName: "", nomineeRelation: "",
  notes: "",
};

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return new Date(val).toISOString().split("T")[0]; } catch { return ""; }
}

function ImageDropZone({
  label, hint, file, preview, onFile, onClear, disabled,
}: {
  label: string; hint: string;
  file: File | null; preview: string | null;
  onFile: (f: File) => void; onClear: () => void;
  disabled: boolean;
}) {
  const [showCamera, setShowCamera] = useState(false);
  const onDrop = useCallback((files: File[]) => { if (files[0]) onFile(files[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1, disabled,
  });

  return (
    <div className="space-y-2">
      <p className="ab-label">{label}</p>
      {preview ? (
        <div className="relative rounded-xl border border-[#2a2a2e] overflow-hidden group bg-[#17171a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onClear}
              className="ab-btn ab-btn-secondary"
              style={{ padding: "8px 14px", fontSize: "13px" }}
            >
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
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
            <p className="text-[13px] text-[#a0a0a5]">{isDragActive ? "Drop here" : hint}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            disabled={disabled}
            className="ab-btn ab-btn-ghost w-full border border-[#2a2a2e]"
            style={{ fontSize: "13px" }}
          >
            <Camera size={14} /> Use Camera
          </button>
        </div>
      )}
      {showCamera && (
        <CameraModal
          onCapture={(f) => { onFile(f); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

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

type PriorRenewal = { startDate: string; maturityDate: string; principal: string; interestRate: string; tenureMonths: string; maturityAmount: string };
const emptyPrior = (): PriorRenewal => ({ startDate: "", maturityDate: "", principal: "", interestRate: "", tenureMonths: "", maturityAmount: "" });

type RenewedFrom = { id: string; bankName: string; fdNumber: string | null; principal: number; maturityDate: Date | string; interestRate: number; tenureMonths: number; nomineeName: string | null; nomineeRelation: string | null } | null;

export function FDNewForm({ renewedFrom, linkToId }: { renewedFrom?: RenewedFrom; linkToId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FDForm>(() => renewedFrom ? {
    ...empty,
    bankName: renewedFrom.bankName,
    startDate: new Date(renewedFrom.maturityDate).toISOString().split("T")[0],
    interestRate: renewedFrom.interestRate.toString(),
    tenureMonths: renewedFrom.tenureMonths.toString(),
    nomineeName: renewedFrom.nomineeName ?? "",
    nomineeRelation: renewedFrom.nomineeRelation ?? "",
  } : empty);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [renewalNumber, setRenewalNumber] = useState<number | null>(null);
  const [priorRenewals, setPriorRenewals] = useState<PriorRenewal[]>([]);
  const [uploadMode, setUploadMode] = useState<"image" | "pdf">("image");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  type SectionId = "receipt" | "prior" | "details" | "renewal" | "notes";

  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    receipt: null,
    prior: null,
    details: null,
    renewal: null,
    notes: null,
  });

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

  const set = (key: keyof FDForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function handleFrontFile(file: File) {
    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
    setExtracted(false);
    setExtractError("");
  }
  function handleBackFile(file: File) {
    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
  }
  function clearFront() { setFrontFile(null); setFrontPreview(null); setExtracted(false); }
  function clearBack() { setBackFile(null); setBackPreview(null); }

  function handlePdfFile(file: File) {
    setPdfFile(file);
    setExtracted(false);
    setExtractError("");
  }
  function clearPdf() { setPdfFile(null); setExtracted(false); }

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

  async function uploadFile(file: File): Promise<string | null> {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch("/api/fd/upload", { method: "POST", body: data });
    if (!res.ok) return null;
    const json = await res.json();
    return json.url ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
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

      const res = await fetch("/api/fd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // If prior renewals exist, FD record stores the ORIGINAL data (priorRenewals[0])
          // otherwise stores AI-extracted data as-is
          principal: priorRenewals.length > 0 ? parseFloat(priorRenewals[0].principal) : parseFloat(form.principal),
          interestRate: priorRenewals.length > 0 ? parseFloat(priorRenewals[0].interestRate) : parseFloat(form.interestRate),
          tenureMonths: priorRenewals.length > 0 ? parseInt(priorRenewals[0].tenureMonths) : parseInt(form.tenureMonths),
          startDate: priorRenewals.length > 0 ? priorRenewals[0].startDate : form.startDate,
          maturityDate: priorRenewals.length > 0 ? priorRenewals[0].maturityDate : form.maturityDate,
          maturityAmount: priorRenewals.length > 0
            ? (priorRenewals[0].maturityAmount ? parseFloat(priorRenewals[0].maturityAmount) : null)
            : (form.maturityAmount ? parseFloat(form.maturityAmount) : null),
          sourceImageUrl,
          sourceImageBackUrl,
          sourcePdfUrl,
          // Renewals: intermediate priors (R1..Rn-1) + current AI data as last renewal
          ...(priorRenewals.length > 0 ? {
            renewals: [
              ...priorRenewals.slice(1).map((r, i) => ({
                renewalNumber: i + 1,
                startDate: r.startDate,
                maturityDate: r.maturityDate,
                principal: parseFloat(r.principal),
                interestRate: parseFloat(r.interestRate),
                tenureMonths: parseInt(r.tenureMonths),
                maturityAmount: r.maturityAmount ? parseFloat(r.maturityAmount) : null,
              })),
              {
                renewalNumber: priorRenewals.length,
                startDate: form.startDate,
                maturityDate: form.maturityDate,
                principal: parseFloat(form.principal),
                interestRate: parseFloat(form.interestRate),
                tenureMonths: parseInt(form.tenureMonths),
                maturityAmount: form.maturityAmount ? parseFloat(form.maturityAmount) : null,
                maturityInstruction: form.maturityInstruction || null,
                payoutFrequency: form.payoutFrequency || null,
              },
            ],
          } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Failed to save."); return; }
      const newId = json.fd.id;
      if (renewalNumber && renewalNumber > 0 && !renewedFrom) {
        router.push(`/dashboard/fd/${newId}?addPrevious=1`);
      } else {
        router.push("/dashboard/fd");
      }
      router.refresh();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      {renewedFrom && (
        <div
          className="ab-card-flat flex items-center gap-2 px-4 py-3 text-[13px]"
          style={{ background: "#2a1218", color: "#e00b41", borderColor: "#3a1820" }}
        >
          <RefreshCw size={14} />
          <span>
            Renewing <strong className="font-semibold">{renewedFrom.bankName}</strong>
            {renewedFrom.fdNumber ? ` - FD #${renewedFrom.fdNumber}` : ""} - start date pre-filled with previous maturity date
          </span>
        </div>
      )}

      {/* AI Digitize panel */}
      <section id="receipt" ref={(el) => { sectionRefs.current.receipt = el; }} className="ab-card p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#2a1218" }}>
            <Sparkles size={18} className="text-[#ff385c]" />
          </div>
          <div>
            <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Digitize Receipt with AI</p>
            <p className="text-[13px] text-[#a0a0a5] mt-0.5">Upload your FD certificate - AI extracts all details automatically.</p>
          </div>
        </div>

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

        {extractError && (
          <div
            className="ab-card-flat px-3 py-2 text-[13px]"
            style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}
          >
            {extractError}
          </div>
        )}

        {((uploadMode === "image" && frontFile) || (uploadMode === "pdf" && pdfFile)) && !extracted && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="ab-btn ab-btn-accent"
          >
            {extracting ? (
              <><Loader2 size={14} className="animate-spin" /> Extracting...</>
            ) : (
              <><Sparkles size={14} /> Extract with AI</>
            )}
          </button>
        )}

        {extracted && (
          <div
            className="ab-card-flat flex items-center gap-2 px-3 py-2 text-[13px]"
            style={{ background: "#0f2a19", color: "#5ee0a4", borderColor: "#1a3a24" }}
          >
            <span className="ab-chip ab-chip-accent">
              <Sparkles size={12} /> AI Extracted
            </span>
            <span>Details extracted - review and confirm below</span>
          </div>
        )}

        {extracted && renewalNumber !== null && renewalNumber > 0 && (
          <div
            className="ab-card-flat px-3 py-2"
            style={{ background: "#2a1f0d", color: "#f5a524", borderColor: "#3a2d0f" }}
          >
            <p className="text-[13px] font-semibold">Renewal #{renewalNumber} detected - fill in previous periods below</p>
          </div>
        )}
      </section>

      {/* Prior renewal sections */}
      {priorRenewals.length > 0 && (
        <section
          id="prior"
          ref={(el) => { sectionRefs.current.prior = el; }}
          className="space-y-6"
        >
          {priorRenewals.map((r, i) => (
            <section key={i} className="ab-card-flat p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={i === 0 ? "ab-chip ab-chip-info" : "ab-chip ab-chip-accent"}>
              {i === 0 ? "Original FD" : `Renewal #${i}`}
            </span>
            <p className="text-[13px] text-[#a0a0a5]">Fill in the details for this period</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["startDate", "maturityDate"] as (keyof PriorRenewal)[]).map((key) => (
              <div key={key}>
                <label className="ab-label">
                  {key === "startDate"
                    ? "Start Date"
                    : i === 0
                      ? "Due Date (original, before renewal)"
                      : "Due Date (before next renewal)"}
                </label>
                <DatePicker
                  value={r[key]}
                  onChange={(v) => setPriorRenewals((prev) => prev.map((p, j) => j === i ? { ...p, [key]: v } : p))}
                />
              </div>
            ))}
            {[
              { label: "Principal (₹)", key: "principal" },
              { label: "Interest Rate (% p.a.)", key: "interestRate" },
              { label: "Tenure (months)", key: "tenureMonths" },
              { label: "Maturity Amount (₹)", key: "maturityAmount" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="ab-label">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  className="ab-input mono"
                  value={r[key as keyof PriorRenewal]}
                  onChange={(e) => setPriorRenewals((prev) => prev.map((p, j) => j === i ? { ...p, [key]: e.target.value } : p))}
                  placeholder={key === "maturityAmount" ? "Optional" : undefined}
                />
              </div>
            ))}
          </div>
            </section>
          ))}
        </section>
      )}

      {/* Main fields */}
      <section id="details" ref={(el) => { sectionRefs.current.details = el; }} className="ab-card p-6 space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {priorRenewals.length > 0 ? (
            <span className="ab-chip ab-chip-accent">Renewal #{priorRenewals.length} (Current)</span>
          ) : null}
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">FD Details</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="bankName" className="ab-label">Bank Name *</label>
            <input id="bankName" className="ab-input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="State Bank of India" required />
          </div>

          <div>
            <label htmlFor="principal" className="ab-label">Principal Amount (₹) *</label>
            <input id="principal" type="number" min="1" step="0.01" className="ab-input mono" value={form.principal} onChange={(e) => set("principal", e.target.value)} placeholder="100000" required />
          </div>

          <div>
            <label htmlFor="interestRate" className="ab-label">Interest Rate (% p.a.) *</label>
            <input id="interestRate" type="number" min="0.01" max="30" step="0.01" className="ab-input mono" value={form.interestRate} onChange={(e) => set("interestRate", e.target.value)} placeholder="7.50" required />
          </div>

          <div>
            <label htmlFor="tenureMonths" className="ab-label">Tenure (months) *</label>
            <input id="tenureMonths" type="number" min="1" className="ab-input mono" value={form.tenureMonths} onChange={(e) => set("tenureMonths", e.target.value)} placeholder="24" required />
          </div>

          <div>
            <label htmlFor="maturityAmount" className="ab-label">Maturity Amount (₹)</label>
            <input id="maturityAmount" type="number" min="1" step="0.01" className="ab-input mono" value={form.maturityAmount} onChange={(e) => set("maturityAmount", e.target.value)} placeholder="Auto-calculated if blank" />
          </div>

          <div>
            <label className="ab-label">{priorRenewals.length > 0 ? "Renewal Start Date *" : "Start Date *"}</label>
            <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} required />
          </div>

          <div>
            <label className="ab-label">{priorRenewals.length > 0 ? "New Due Date *" : "Maturity Date *"}</label>
            <DatePicker value={form.maturityDate} onChange={(v) => set("maturityDate", v)} required />
          </div>

          <div>
            <label className="ab-label">Interest Type *</label>
            <select className="ab-input" value={form.interestType} onChange={(e) => set("interestType", e.target.value)}>
              <option value="compound">Compound</option>
              <option value="simple">Simple</option>
            </select>
          </div>

          {form.interestType === "compound" && (
            <div>
              <label className="ab-label">Compounding Frequency</label>
              <select className="ab-input" value={form.compoundFreq} onChange={(e) => set("compoundFreq", e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="fdNumber" className="ab-label">FD Number / Certificate No.</label>
            <input id="fdNumber" className="ab-input" value={form.fdNumber} onChange={(e) => set("fdNumber", e.target.value)} placeholder="FD123456" />
          </div>
          <div>
            <label htmlFor="accountNumber" className="ab-label">Account Number</label>
            <input id="accountNumber" className="ab-input" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} placeholder="XXXXXXXXXXXX" />
          </div>
        </div>
      </section>

      {/* Renewal & nominee (from back of certificate) */}
      <section id="renewal" ref={(el) => { sectionRefs.current.renewal = el; }} className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Renewal &amp; Nominee</p>
          <p className="text-[13px] text-[#a0a0a5] mt-0.5">Usually printed on the back of the FD receipt.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="ab-label">Maturity Instruction</label>
            <select className="ab-input" value={form.maturityInstruction} onChange={(e) => set("maturityInstruction", e.target.value)}>
              <option value="">Not specified</option>
              <option value="renew_principal_interest">Auto-renew principal + interest</option>
              <option value="renew_principal">Auto-renew principal, payout interest</option>
              <option value="payout">Credit to savings on maturity</option>
            </select>
          </div>
          <div>
            <label className="ab-label">Interest Payout Frequency</label>
            <select className="ab-input" value={form.payoutFrequency} onChange={(e) => set("payoutFrequency", e.target.value)}>
              <option value="">Not specified</option>
              <option value="on_maturity">On maturity (cumulative)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-yearly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div>
            <label htmlFor="nomineeName" className="ab-label">Nominee Name</label>
            <input id="nomineeName" className="ab-input" value={form.nomineeName} onChange={(e) => set("nomineeName", e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label htmlFor="nomineeRelation" className="ab-label">Nominee Relation</label>
            <input id="nomineeRelation" className="ab-input" value={form.nomineeRelation} onChange={(e) => set("nomineeRelation", e.target.value)} placeholder="Spouse, Son, Daughter..." />
          </div>
        </div>
      </section>

      {/* Optional fields */}
      <section id="notes" ref={(el) => { sectionRefs.current.notes = el; }} className="ab-card-flat overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptional((s) => !s)}
          className="flex items-center justify-between w-full px-6 py-4 text-[16px] font-semibold text-[#ededed] tracking-tight hover:bg-[#1c1c20] transition-colors"
        >
          <span>Optional Details</span>
          {showOptional ? <ChevronUp size={16} className="text-[#a0a0a5]" /> : <ChevronDown size={16} className="text-[#a0a0a5]" />}
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

      {saveError && (
        <div
          className="ab-card-flat px-3 py-2 text-[13px]"
          style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}
        >
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
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
          {saving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving...</>
          ) : (
            "Save Fixed Deposit"
          )}
        </button>
      </div>
    </form>
  );
}
