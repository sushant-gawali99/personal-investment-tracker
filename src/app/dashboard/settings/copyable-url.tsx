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
    <span className="inline-flex items-center gap-1.5 bg-[#f7f7f7] px-2 py-1 rounded-md border border-[#ebebeb]">
      <code className="text-[12px] mono text-[#222222]">{url}</code>
      <button
        onClick={copy}
        className="text-[#6a6a6a] hover:text-[#ff385c] transition-colors shrink-0"
        aria-label="Copy URL"
      >
        {copied ? <Check size={12} className="text-[#00a651]" /> : <Copy size={12} />}
      </button>
    </span>
  );
}
