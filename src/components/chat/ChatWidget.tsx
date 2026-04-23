"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="h-[520px] w-[340px] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl flex flex-col">
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f172a] text-xl text-white shadow-lg hover:bg-[#1e293b] transition-colors"
        aria-label="Open financial assistant"
      >
        {open ? "✕" : "✨"}
      </button>
    </div>
  );
}
