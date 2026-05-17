"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle, X } from "lucide-react";

export function FDDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/fd/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  const modal = showConfirm && createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-[var(--border)] overflow-hidden"
        style={{ background: "var(--surface-deep)" }}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <AlertTriangle size={16} style={{ color: "var(--accent-error)" }} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight flex-1">Delete FD permanently?</p>
          <button
            onClick={() => setShowConfirm(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-[var(--text-secondary)]">
            This will permanently delete this FD and all its renewal history. This action cannot be undone.
          </p>
        </div>
        <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="ab-btn ab-btn-ghost w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ab-btn ab-btn-secondary w-full sm:w-auto"
            style={{ color: "var(--accent-error)", borderColor: "rgba(255, 122, 110, 0.3)" }}
          >
            {deleting ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : <><Trash2 size={13} /> Delete permanently</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors text-[var(--accent-error)] hover:bg-[var(--chip-error-bg)]"
        aria-label="Delete FD"
      >
        <Trash2 size={14} />
      </button>
      {modal}
    </>
  );
}
