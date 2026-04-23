"use client";

import { useRef, useEffect, useState } from "react";
import type { ChatMessage, Citation, SSEChunk } from "@/lib/chat/types";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

const STARTERS = [
  "How much did I spend this month?",
  "What's my total FD value?",
  "Show my net worth summary",
];

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Append a placeholder for streaming assistant message
    const assistantIndex = updatedMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok || !response.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIndex] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
          return next;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let citations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const chunk = JSON.parse(line.slice(6)) as SSEChunk;

          if (chunk.type === "text") {
            setMessages((prev) => {
              const next = [...prev];
              next[assistantIndex] = {
                ...next[assistantIndex],
                content: next[assistantIndex].content + chunk.content,
              };
              return next;
            });
          } else if (chunk.type === "citations") {
            citations = chunk.records;
          } else if (chunk.type === "error") {
            setMessages((prev) => {
              const next = [...prev];
              next[assistantIndex] = {
                role: "assistant",
                content: `Error: ${chunk.message}`,
              };
              return next;
            });
          } else if (chunk.type === "done") {
            if (citations.length > 0) {
              setMessages((prev) => {
                const next = [...prev];
                next[assistantIndex] = {
                  ...next[assistantIndex],
                  citations,
                };
                return next;
              });
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0f172a] px-4 py-3">
        <span className="text-sm font-semibold text-white">✨ Financial Assistant</span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b]">Try asking:</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#f1f5f9]"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => <ChatMessageComponent key={i} message={msg} />)
        )}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-1 px-3 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#94a3b8]" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={send} disabled={loading} />
    </div>
  );
}
