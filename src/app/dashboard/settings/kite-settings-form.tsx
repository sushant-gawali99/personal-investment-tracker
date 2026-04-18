"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink, Eye, EyeOff } from "lucide-react";

interface Props {
  savedApiKey: string;
  isConnected: boolean;
}

const inputCls = "w-full bg-[#0e0e11] ghost-border rounded-lg px-3 py-2.5 text-sm text-[#e4e1e6] placeholder:text-[#cbc4d0] focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors mono";
const labelCls = "block text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label mb-1.5";

export function KiteSettingsForm({ savedApiKey, isConnected }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState(savedApiKey);
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError("Both API key and secret are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/kite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setApiSecret("");
      router.refresh();
    } catch {
      setError("Failed to save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/settings/kite", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-[#1b1b1e] ghost-border rounded-xl p-6 space-y-5">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <CheckCircle2 size={14} className="text-primary" />
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-headline font-bold">Connected</span>
          </>
        ) : (
          <>
            <XCircle size={14} className="text-[#cbc4d0]" />
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#2a2a2d] text-[#cbc4d0] ghost-border font-headline font-bold">Not connected</span>
          </>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="apiKey" className={labelCls}>API Key</label>
          <input
            id="apiKey"
            className={inputCls}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="kitexxxxxxxxxxx"
          />
        </div>

        <div>
          <label htmlFor="apiSecret" className={labelCls}>API Secret</label>
          <div className="relative">
            <input
              id="apiSecret"
              type={showSecret ? "text" : "password"}
              className={inputCls + " pr-10"}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={savedApiKey ? "Enter new secret to update" : "Paste your API secret"}
            />
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cbc4d0] hover:text-[#e4e1e6] transition-colors"
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-[#cbc4d0] mt-1.5">Secret is never shown after saving.</p>
        </div>

        {error && <p className="text-xs text-[#ffafd7] bg-[#ffafd7]/5 border border-[#ffafd7]/20 rounded-lg px-3 py-2">{error}</p>}
        {saved && <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">Credentials saved successfully.</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors shadow-[0_0_12px_rgba(0,223,193,0.2)]"
          >
            {saving ? "Saving…" : "Save credentials"}
          </button>

          {savedApiKey && (
            <a
              href="/api/kite/login"
              className="inline-flex items-center gap-1.5 rounded-lg ghost-border px-4 py-2 text-xs font-headline font-bold text-[#cbc4d0] hover:text-[#e4e1e6] hover:bg-[#0e0e11] transition-colors"
            >
              Connect Zerodha
              <ExternalLink size={12} />
            </a>
          )}

          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-lg px-4 py-2 text-xs font-headline font-bold text-[#ffafd7] hover:bg-[#ffafd7]/10 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
