"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="mb-2 space-y-1 pl-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 space-y-1 pl-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto rounded-lg border border-[#e2e8f0]">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-[#e8edf4] text-[#475569]">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-[#e2e8f0]">{children}</tbody>,
                tr: ({ children }) => <tr>{children}</tr>,
                th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2">{children}</td>,
                code: ({ children }) => (
                  <code className="rounded bg-[#e2e8f0] px-1 py-0.5 font-mono text-xs">{children}</code>
                ),
                h1: ({ children }) => <h1 className="mb-1 text-base font-bold">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationBlock records={message.citations} />
        )}
      </div>
    </div>
  );
}
