"use client";

import { useState, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex gap-2 border-t border-[#e2e8f0] p-2">
      <textarea
        className="flex-1 resize-none rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]"
        rows={1}
        placeholder={disabled ? "Thinking…" : "Ask anything about your finances…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <button
        className="rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-white disabled:opacity-40"
        onClick={submit}
        disabled={disabled || !value.trim()}
      >
        ↑
      </button>
    </div>
  );
}
