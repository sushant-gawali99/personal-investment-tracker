"use client";

import { useState } from "react";
import type { ChatMessage as ChatMessageType, Citation } from "@/lib/chat/types";

function CitationBlock({ records }: { records: Citation[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 text-xs">
      <button
        className="flex w-full items-center gap-1 px-3 py-2 text-blue-700 font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span>📎 {records.length} source{records.length !== 1 ? "s" : ""}</span>
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="border-t border-blue-200 px-3 py-2 space-y-1 text-blue-900">
          {records.slice(0, 10).map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="truncate">
                {c.date && <span className="text-blue-500 mr-1">{c.date}</span>}
                {c.description ?? c.label ?? c.id}
              </span>
              {c.amount !== undefined && (
                <span className={c.direction === "credit" ? "text-green-600" : ""}>
                  {c.direction === "debit" ? "-" : "+"}₹
                  {c.amount.toLocaleString("en-IN")}
                </span>
              )}
            </li>
          ))}
          {records.length > 10 && (
            <li className="text-blue-500">+{records.length - 10} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-[#1e293b] text-white"
              : "rounded-bl-sm bg-[#f1f5f9] text-[#1e293b]"
          }`}
        >
          {message.content}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationBlock records={message.citations} />
        )}
      </div>
    </div>
  );
}
