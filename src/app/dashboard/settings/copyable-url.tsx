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
    <span className="inline-flex items-center gap-1.5 bg-[#1b1b1e] px-1.5 py-0.5 rounded">
      <code className="text-xs mono text-[#d2bcfa]">{url}</code>
      <button
        onClick={copy}
        className="text-[#cbc4d0] hover:text-primary transition-colors shrink-0"
        aria-label="Copy URL"
      >
        {copied ? <Check size={11} className="text-primary" /> : <Copy size={11} />}
      </button>
    </span>
  );
}
