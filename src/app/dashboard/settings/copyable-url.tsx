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
    <span className="inline-flex items-center gap-1.5 bg-[#1c1c20] px-2 py-1 rounded-md border border-[#2a2a2e]">
      <code className="text-[12px] mono text-[#ededed]">{url}</code>
      <button
        onClick={copy}
        className="text-[#a0a0a5] hover:text-[#ff385c] transition-colors shrink-0"
        aria-label="Copy URL"
      >
        {copied ? <Check size={12} className="text-[#5ee0a4]" /> : <Copy size={12} />}
      </button>
    </span>
  );
}
