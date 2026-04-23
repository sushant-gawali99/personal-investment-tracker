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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl text-white shadow-[0_4px_24px_rgba(124,58,237,0.5)] hover:shadow-[0_4px_32px_rgba(124,58,237,0.7)] hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Open financial assistant"
      >
        {open ? "✕" : "✨"}
      </button>
    </div>
  );
}
