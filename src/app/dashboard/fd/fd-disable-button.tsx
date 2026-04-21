"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

export function FDDisableButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  const label = disabled ? "Enable" : "Disable";
  const Icon = disabled ? RotateCcw : Archive;
  const styleProps = disabled
    ? undefined
    : { color: "#f5a524", borderColor: "rgba(245, 165, 36, 0.3)" };

  return (
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
  );
}
