"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function SyncStatus({ syncedAt, sessionExpired }: { syncedAt: string | null; sessionExpired: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/kite/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sync failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (sessionExpired) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Last synced</p>
          <p className="text-[13px] text-[#ededed] font-semibold mt-0.5">
            {syncedAt ? formatRelative(syncedAt) : "Never"}
          </p>
          <p className="text-[11px] text-[#f5a524] mt-0.5 flex items-center justify-end gap-1 font-medium">
            <AlertTriangle size={11} /> Session expired
          </p>
        </div>
        <a href="/api/kite/login" className={cn("ab-btn ab-btn-primary")}>
          <RefreshCw size={14} />
          Sync Now
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-[11px] text-[#a0a0a5] uppercase tracking-wider font-semibold">Last synced</p>
        <p className="text-[13px] text-[#ededed] font-semibold mt-0.5">
          {syncedAt ? formatRelative(syncedAt) : "Never"}
        </p>
        {error && <p className="text-[11px] text-[#ff7a6e] mt-0.5 font-medium">{error}</p>}
      </div>
      <button
        onClick={sync}
        disabled={syncing}
        className={cn("ab-btn ab-btn-primary")}
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}
