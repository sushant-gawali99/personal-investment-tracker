"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Loader2, Trash2, AlertTriangle, X } from "lucide-react";

export function FDDisableButton({ id, disabled, showDelete = false }: { id: string; disabled: boolean; showDelete?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    const confirmMsg = disabled
      ? "Enable this FD? It will reappear in the main list."
      : "Disable this FD? It will be hidden from the list and excluded from totals. You can re-enable it from the Disabled filter.";
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fetch(`/api/fd/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !disabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/fd/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const label = disabled ? "Enable" : "Disable";
  const Icon = disabled ? RotateCcw : Archive;
  const styleProps = disabled
    ? undefined
    : { color: "#f5a524", borderColor: "rgba(245, 165, 36, 0.3)" };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        className="ab-btn ab-btn-secondary"
        style={styleProps}
        aria-label={label}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
        {busy ? (disabled ? "Enabling…" : "Disabling…") : label}
      </button>

      {disabled && showDelete && (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="ab-btn ab-btn-secondary"
          style={{ color: "#ff7a6e", borderColor: "rgba(255, 122, 110, 0.3)" }}
          aria-label="Delete"
        >
          <Trash2 size={13} /> Delete
        </button>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[#2a2a2e] overflow-hidden"
            style={{ background: "#131316" }}
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[#2a2a2e]">
              <AlertTriangle size={16} style={{ color: "#ff7a6e" }} />
              <p className="text-[15px] font-semibold text-[#ededed] tracking-tight flex-1">Delete FD permanently?</p>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#a0a0a5] hover:bg-[#1c1c20] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-[#a0a0a5]">
                This will permanently delete this FD and all its renewal history. This action cannot be undone.
              </p>
            </div>
            <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="ab-btn ab-btn-ghost w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="ab-btn ab-btn-secondary w-full sm:w-auto"
                style={{ color: "#ff7a6e", borderColor: "rgba(255, 122, 110, 0.3)" }}
              >
                {deleting ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : <><Trash2 size={13} /> Delete permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
