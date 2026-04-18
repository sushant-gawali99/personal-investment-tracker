"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, Sparkles, ChevronDown, ChevronUp, X, Camera, RefreshCw } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#0e0e11] ghost-border rounded-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(73,69,78,0.15)]">
          <p className="font-headline font-bold text-sm text-[#e4e1e6]">Take Photo</p>
          <button onClick={onClose} className="text-[#cbc4d0] hover:text-[#e4e1e6]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          {error ? (
            <p className="text-xs text-[#ffafd7] bg-[#ffafd7]/5 border border-[#ffafd7]/20 rounded-lg px-3 py-2">{error}</p>
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl aspect-[4/3] bg-black object-cover" />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={capture}
              disabled={!!error || capturing}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors"
            >
              <Camera size={13} /> Capture
            </button>
            <button type="button" onClick={onClose} className="rounded-lg ghost-border px-4 py-2.5 text-xs font-headline font-bold text-[#cbc4d0] hover:text-[#e4e1e6] transition-colors">
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

const inputCls = "w-full bg-[#0e0e11] ghost-border rounded-lg px-3 py-2.5 text-sm text-[#e4e1e6] placeholder:text-[#cbc4d0] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";
const labelCls = "block text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label mb-1.5";

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
    <div className="space-y-1.5">
      <p className={labelCls}>{label}</p>
      {preview ? (
        <div className="relative rounded-xl ghost-border overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full h-36 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button type="button" onClick={onClear} className="flex items-center gap-1.5 text-[#e4e1e6] text-xs font-headline font-bold bg-[#0e0e11]/80 rounded-lg px-3 py-1.5">
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            {...getRootProps()}
            className={cn(
              "rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-[#49454e]/40 hover:border-primary/40 hover:bg-primary/5",
              disabled && "pointer-events-none opacity-40"
            )}
          >
            <input {...getInputProps()} />
            <Upload size={16} className="mx-auto mb-1.5 text-[#cbc4d0]" />
            <p className="text-xs text-[#cbc4d0]">{isDragActive ? "Drop here" : hint}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#49454e]/40 hover:border-primary/40 hover:bg-primary/5 py-2 text-xs text-[#cbc4d0] hover:text-primary font-headline font-bold transition-colors disabled:opacity-40"
          >
            <Camera size={12} /> Use Camera
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

type RenewedFrom = { id: string; bankName: string; fdNumber: string | null; principal: number; maturityDate: Date | string; interestRate: number; tenureMonths: number; nomineeName: string | null; nomineeRelation: string | null } | null;

export function FDNewForm({ renewedFrom }: { renewedFrom?: RenewedFrom }) {
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
  const [dismissedRenewalWarning, setDismissedRenewalWarning] = useState(false);

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

  async function handleExtract() {
    if (!frontFile) return;
    setExtracting(true);
    setExtractError("");
    const data = new FormData();
    data.append("front", frontFile);
    if (backFile) data.append("back", backFile);

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
      setRenewalNumber(e.renewalNumber ?? null);
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
      const [sourceImageUrl, sourceImageBackUrl] = await Promise.all([
        frontFile ? uploadFile(frontFile) : Promise.resolve(null),
        backFile ? uploadFile(backFile) : Promise.resolve(null),
      ]);

      const res = await fetch("/api/fd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          principal: parseFloat(form.principal),
          interestRate: parseFloat(form.interestRate),
          tenureMonths: parseInt(form.tenureMonths),
          maturityAmount: form.maturityAmount ? parseFloat(form.maturityAmount) : null,
          sourceImageUrl,
          sourceImageBackUrl,
          renewedFromId: renewedFrom?.id ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? "Failed to save."); return; }
      router.push("/dashboard/fd");
      router.refresh();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {renewedFrom && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <RefreshCw size={12} />
          <span>Renewing <strong>{renewedFrom.bankName}</strong>{renewedFrom.fdNumber ? ` · FD #${renewedFrom.fdNumber}` : ""} — start date pre-filled with previous maturity date</span>
        </div>
      )}

      {/* AI Digitize panel */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={15} className="text-primary" />
          </div>
          <div>
            <p className="font-headline font-bold text-sm text-[#e4e1e6]">Digitize Receipt with AI</p>
            <p className="text-xs text-[#cbc4d0] mt-0.5">Upload your FD certificate — AI extracts all details automatically.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ImageDropZone
            label="Front side *"
            hint="Click or drag · JPEG, PNG, WebP"
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

        {extractError && (
          <p className="text-xs text-[#ffafd7] bg-[#ffafd7]/5 border border-[#ffafd7]/20 rounded-lg px-3 py-2">{extractError}</p>
        )}

        {frontFile && !extracted && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors shadow-[0_0_12px_rgba(0,223,193,0.2)]"
          >
            {extracting ? (
              <><Loader2 size={13} className="animate-spin" /> Extracting…</>
            ) : (
              <><Sparkles size={13} /> Extract with AI</>
            )}
          </button>
        )}

        {extracted && (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            <Sparkles size={12} />
            <span>Details extracted — review and confirm below</span>
          </div>
        )}

        {extracted && renewalNumber !== null && renewalNumber > 0 && !renewedFrom && !dismissedRenewalWarning && (
          <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2.5 space-y-1.5">
            <p className="text-xs text-amber-400 font-headline font-bold">This appears to be Renewal #{renewalNumber}</p>
            <p className="text-[11px] text-[#cbc4d0] leading-relaxed">
              The certificate suggests this FD has been renewed {renewalNumber} time{renewalNumber > 1 ? "s" : ""} before.
              If the previous {renewalNumber > 1 ? "renewals exist" : "FD exists"} in MyFolio, save this FD first, then link them using the <strong className="text-[#e4e1e6]">Renew</strong> button on each FD&apos;s detail page.
              If they don&apos;t exist yet, you can add them afterwards and build the chain.
            </p>
            <button type="button" onClick={() => setDismissedRenewalWarning(true)} className="text-[11px] text-[#cbc4d0] hover:text-[#e4e1e6] underline">Dismiss</button>
          </div>
        )}
      </div>

      {/* Main fields */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-6 space-y-5">
        <p className="font-headline font-bold text-sm text-[#e4e1e6]">FD Details</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="bankName" className={labelCls}>Bank Name *</label>
            <input id="bankName" className={inputCls} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="State Bank of India" required />
          </div>

          <div>
            <label htmlFor="principal" className={labelCls}>Principal Amount (₹) *</label>
            <input id="principal" type="number" min="1" step="0.01" className={inputCls} value={form.principal} onChange={(e) => set("principal", e.target.value)} placeholder="100000" required />
          </div>

          <div>
            <label htmlFor="interestRate" className={labelCls}>Interest Rate (% p.a.) *</label>
            <input id="interestRate" type="number" min="0.01" max="30" step="0.01" className={inputCls} value={form.interestRate} onChange={(e) => set("interestRate", e.target.value)} placeholder="7.50" required />
          </div>

          <div>
            <label htmlFor="tenureMonths" className={labelCls}>Tenure (months) *</label>
            <input id="tenureMonths" type="number" min="1" className={inputCls} value={form.tenureMonths} onChange={(e) => set("tenureMonths", e.target.value)} placeholder="24" required />
          </div>

          <div>
            <label htmlFor="maturityAmount" className={labelCls}>Maturity Amount (₹)</label>
            <input id="maturityAmount" type="number" min="1" step="0.01" className={inputCls} value={form.maturityAmount} onChange={(e) => set("maturityAmount", e.target.value)} placeholder="Auto-calculated if blank" />
          </div>

          <div>
            <label htmlFor="startDate" className={labelCls}>Start Date *</label>
            <input id="startDate" type="date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
          </div>

          <div>
            <label htmlFor="maturityDate" className={labelCls}>Maturity Date *</label>
            <input id="maturityDate" type="date" className={inputCls} value={form.maturityDate} onChange={(e) => set("maturityDate", e.target.value)} required />
          </div>

          <div>
            <label className={labelCls}>Interest Type *</label>
            <select className={inputCls} value={form.interestType} onChange={(e) => set("interestType", e.target.value)}>
              <option value="compound">Compound</option>
              <option value="simple">Simple</option>
            </select>
          </div>

          {form.interestType === "compound" && (
            <div>
              <label className={labelCls}>Compounding Frequency</label>
              <select className={inputCls} value={form.compoundFreq} onChange={(e) => set("compoundFreq", e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Renewal & nominee (from back of certificate) */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl p-6 space-y-5">
        <div>
          <p className="font-headline font-bold text-sm text-[#e4e1e6]">Renewal &amp; Nominee</p>
          <p className="text-[11px] text-[#cbc4d0] mt-0.5">Usually printed on the back of the FD receipt.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Maturity Instruction</label>
            <select className={inputCls} value={form.maturityInstruction} onChange={(e) => set("maturityInstruction", e.target.value)}>
              <option value="">Not specified</option>
              <option value="renew_principal_interest">Auto-renew principal + interest</option>
              <option value="renew_principal">Auto-renew principal, payout interest</option>
              <option value="payout">Credit to savings on maturity</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Interest Payout Frequency</label>
            <select className={inputCls} value={form.payoutFrequency} onChange={(e) => set("payoutFrequency", e.target.value)}>
              <option value="">Not specified</option>
              <option value="on_maturity">On maturity (cumulative)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-yearly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div>
            <label htmlFor="nomineeName" className={labelCls}>Nominee Name</label>
            <input id="nomineeName" className={inputCls} value={form.nomineeName} onChange={(e) => set("nomineeName", e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label htmlFor="nomineeRelation" className={labelCls}>Nominee Relation</label>
            <input id="nomineeRelation" className={inputCls} value={form.nomineeRelation} onChange={(e) => set("nomineeRelation", e.target.value)} placeholder="Spouse, Son, Daughter…" />
          </div>
        </div>
      </div>

      {/* Optional fields */}
      <div className="bg-[#1b1b1e] ghost-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOptional((s) => !s)}
          className="flex items-center justify-between w-full px-6 py-4 font-headline font-bold text-sm text-[#cbc4d0] hover:text-[#e4e1e6] hover:bg-[#0e0e11]/40 transition-colors"
        >
          <span>Optional Details</span>
          {showOptional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showOptional && (
          <div className="px-6 pb-6 grid grid-cols-2 gap-4 border-t border-[rgba(73,69,78,0.15)] pt-5">
            <div>
              <label htmlFor="fdNumber" className={labelCls}>FD Number / Certificate No.</label>
              <input id="fdNumber" className={inputCls} value={form.fdNumber} onChange={(e) => set("fdNumber", e.target.value)} placeholder="FD123456" />
            </div>
            <div>
              <label htmlFor="accountNumber" className={labelCls}>Account Number</label>
              <input id="accountNumber" className={inputCls} value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} placeholder="XXXXXXXXXXXX" />
            </div>
            <div className="col-span-2">
              <label htmlFor="notes" className={labelCls}>Notes</label>
              <textarea id="notes" rows={3} className={inputCls + " resize-none"} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <p className="text-xs text-[#ffafd7] bg-[#ffafd7]/5 border border-[#ffafd7]/20 rounded-lg px-3 py-2">{saveError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2.5 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors shadow-[0_0_12px_rgba(0,223,193,0.2)]"
        >
          {saving ? "Saving…" : "Save Fixed Deposit"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg ghost-border px-5 py-2.5 text-xs font-headline font-bold text-[#cbc4d0] hover:text-[#e4e1e6] hover:bg-[#1b1b1e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
