"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ExternalLink, Eye, EyeOff } from "lucide-react";

interface Props {
  savedApiKey: string;
  isConnected: boolean;
}

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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <CheckCircle2 size={16} className="text-[var(--accent-success)]" />
            <span className="ab-chip ab-chip-success">Connected</span>
          </>
        ) : (
          <>
            <XCircle size={16} className="text-[var(--text-secondary)]" />
            <span className="ab-chip">Not connected</span>
          </>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="apiKey" className="ab-label">API Key</label>
          <input
            id="apiKey"
            className="ab-input mono"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="kitexxxxxxxxxxx"
          />
        </div>

        <div>
          <label htmlFor="apiSecret" className="ab-label">API Secret</label>
          <div className="relative">
            <input
              id="apiSecret"
              type={showSecret ? "text" : "password"}
              className="ab-input mono pr-10"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={savedApiKey ? "Enter new secret to update" : "Paste your API secret"}
            />
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1.5">Secret is never shown after saving.</p>
        </div>

        {error && <p className="text-[13px] text-[var(--accent-error)] bg-[var(--chip-error-bg)] rounded-lg px-3 py-2.5 font-medium">{error}</p>}
        {saved && <p className="text-[13px] text-[var(--accent-success)] bg-[var(--chip-success-bg)] rounded-lg px-3 py-2.5 font-medium">Credentials saved successfully.</p>}

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="ab-btn ab-btn-accent"
          >
            {saving ? "Saving…" : "Save credentials"}
          </button>

          {savedApiKey && (
            <a
              href="/api/kite/login"
              className="ab-btn ab-btn-secondary"
            >
              Connect Zerodha
              <ExternalLink size={13} />
            </a>
          )}

          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="ab-btn ab-btn-ghost text-[var(--accent-error)] hover:bg-[var(--chip-error-bg)]"
            >
              Disconnect
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
