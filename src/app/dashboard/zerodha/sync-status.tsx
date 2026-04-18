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

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label">Last synced</p>
        <p className="text-xs text-[#e4e1e6] font-headline font-bold mt-0.5">
          {syncedAt ? formatRelative(syncedAt) : "Never"}
        </p>
        {error && <p className="text-[10px] text-[#ffafd7] mt-0.5">{error}</p>}
        {sessionExpired && !error && (
          <p className="text-[10px] text-amber-400 mt-0.5 flex items-center justify-end gap-1">
            <AlertTriangle size={10} /> Session expired — reconnect
          </p>
        )}
      </div>
      <button
        onClick={sync}
        disabled={syncing || sessionExpired}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors shadow-[0_0_12px_rgba(0,223,193,0.2)]"
        )}
      >
        {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}
