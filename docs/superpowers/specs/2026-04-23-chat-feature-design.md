# Chat Feature Design

**Date:** 2026-04-23  
**Status:** Approved

## Overview

A floating AI chat widget that lets users ask natural language questions about their full financial portfolio — bank transactions, fixed deposits, equity holdings, and gold. Read-only. Supports follow-up questions. Cites the specific records it used to answer.

## Requirements

- **Scope:** All data — transactions, FDs, equity (Kite), gold
- **Conversation:** Follow-up questions supported via full message history sent per request
- **Read-only:** No write actions from chat
- **Placement:** Floating widget (FAB button, bottom-right, accessible from any page)
- **Empty state:** Suggested starter questions shown when no messages exist
- **Citations:** AI responses include a collapsible source list of the specific records used

## Architecture

### 1. Frontend — ChatWidget Component

- Always mounted in the root layout (`src/app/layout.tsx`)
- Renders a `✨` FAB button fixed bottom-right
- Opens as a slide-up panel (no page navigation required)
- Conversation history stored in React `useState` — client-side only, cleared on refresh
- Streams response tokens as they arrive; citations rendered as a block below the answer
- Suggested starters shown when `messages.length === 0`

**Files:**
- `src/components/chat/ChatWidget.tsx` — root widget with open/close state
- `src/components/chat/ChatPanel.tsx` — panel with message list and input
- `src/components/chat/ChatMessage.tsx` — single message with optional citation block
- `src/components/chat/ChatInput.tsx` — input field with submit

### 2. API Route — `/api/chat`

POST endpoint that:
1. Receives `{ messages: Message[] }` (full conversation history)
2. Authenticates via existing NextAuth session
3. Calls Claude `claude-sonnet-4-6` with tools defined and conversation history
4. Intercepts tool calls, runs Prisma queries, injects results
5. Streams final response back as `text/event-stream`

**File:** `src/app/api/chat/route.ts`

### 3. Tool Layer — 6 Prisma-backed tools

| Tool | Parameters | Data source |
|------|-----------|-------------|
| `search_transactions` | `keyword?, fromDate?, toDate?, minAmount?, maxAmount?, categoryId?` | `Transaction` table |
| `get_transaction_summary` | `fromDate?, toDate?, groupBy: 'category'\|'month'\|'payee'` | `Transaction` aggregation |
| `get_fixed_deposits` | _(none)_ | `FixedDeposit` + `FDRenewal` |
| `get_equity_holdings` | _(none)_ | Latest `KiteSnapshot` |
| `get_gold_holdings` | _(none)_ | `GoldItem` + latest `GoldRate` |
| `get_net_worth_summary` | _(none)_ | All asset types combined |

**File:** `src/lib/chat/tools.ts` — tool definitions and Prisma query implementations

### 4. System Prompt

- Establishes the assistant as a personal finance helper
- Instructs Claude to always cite sources by returning a `citations` array alongside its answer
- Instructs Claude to be concise and use Indian currency formatting (₹)
- Instructs Claude to say "I couldn't find data for that" rather than guessing

**File:** `src/lib/chat/system-prompt.ts`

## UI Design

### Closed state
- Dark `✨` FAB button (44×44px), bottom-right, fixed position, all pages

### Open state — empty
- Panel (320px wide, up to 480px tall) slides up from the FAB
- Header: dark background, "✨ Financial Assistant" title, close button
- Body: 3 suggested starter chips (clickable, populate the input)
- Footer: text input + send button

### Open state — active conversation
- User messages: dark bubble, right-aligned
- AI messages: light grey bubble, left-aligned, streamed token-by-token
- Citations: blue-tinted card below AI message, collapsible, shows record list (date · description · amount)
- Typing indicator: three dots while waiting for response

### Suggested starters
1. "How much did I spend this month?"
2. "What's my total FD value?"
3. "Show my net worth summary"

## Data Flow

```
User types message
  → append to messages[] state
  → POST /api/chat with full messages[]
  → Claude decides which tool(s) to call
  → Server runs Prisma query for each tool call
  → Results injected back into Claude context
  → Claude streams final answer + citations
  → Frontend renders streamed tokens
  → Citation block rendered below answer
```

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Tool query fails | Claude told "tool error", informs user data unavailable |
| No matching data | Claude responds naturally: "I couldn't find any transactions matching X" |
| Network error | Inline error in widget with retry button |
| Response timeout (>30s) | Abort stream, show friendly timeout message |

## Out of Scope (MVP)

- Persistent chat history across sessions
- Write actions (categorize, update FD, etc.)
- Export of chat conversation
- Agentic tool chaining (Claude sees tool result → calls another tool → repeats) — MVP supports one round: Claude calls tools, all results injected at once, Claude generates final answer
