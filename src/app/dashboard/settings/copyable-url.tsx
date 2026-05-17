"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="inline-flex items-center gap-1.5 bg-[var(--surface-muted)] px-2 py-1 rounded-md border border-[var(--border)]">
      <code className="text-[12px] mono text-[var(--text-primary)]">{url}</code>
      <button
        onClick={copy}
        className="text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors shrink-0"
        aria-label="Copy URL"
      >
        {copied ? <Check size={12} className="text-[var(--accent-success)]" /> : <Copy size={12} />}
      </button>
    </span>
  );
}
