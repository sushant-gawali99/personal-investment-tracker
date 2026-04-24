// src/lib/chat/types.ts

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  citations?: Citation[];
}

export interface Citation {
  id: string;
  type: "transaction" | "fd" | "equity" | "gold" | "mf";
  date?: string;
  description?: string;
  amount?: number;
  direction?: "debit" | "credit";
  label?: string;
}

export type SSEChunk =
  | { type: "text"; content: string }
  | { type: "citations"; records: Citation[] }
  | { type: "error"; message: string }
  | { type: "done" };
