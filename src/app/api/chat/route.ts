// src/app/api/chat/route.ts
import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { anthropic } from "@/lib/anthropic";
import { getSystemPrompt } from "@/lib/chat/system-prompt";
import { TOOL_DEFINITIONS } from "@/lib/chat/tool-definitions";
import { runTool } from "@/lib/chat/tool-runners";
import type { SSEChunk } from "@/lib/chat/types";

export const runtime = "nodejs";

function encode(chunk: SSEChunk): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { messages } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      const systemPrompt = getSystemPrompt();
      // Phase 1: non-streaming call to handle tool use
      const firstResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      const toolUseBlocks = firstResponse.content.filter((b) => b.type === "tool_use");
      const allCitations: import("@/lib/chat/types").Citation[] = [];

      if (toolUseBlocks.length > 0) {
        // Run all requested tools in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") return null;
            const { records, citations } = await runTool(
              block.name,
              block.input as Record<string, unknown>,
              userId
            );
            allCitations.push(...citations);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(records),
            };
          })
        );

        // Phase 2: stream final response with tool results injected
        const finalStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            ...messages,
            { role: "assistant" as const, content: firstResponse.content },
            {
              role: "user" as const,
              content: toolResults.filter(Boolean) as {
                type: "tool_result";
                tool_use_id: string;
                content: string;
              }[],
            },
          ],
        });

        for await (const event of finalStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            await writer.write(encode({ type: "text", content: event.delta.text }));
          }
        }
      } else {
        // No tool calls — send existing text directly
        const text = firstResponse.content.find((b) => b.type === "text");
        if (text && text.type === "text") {
          await writer.write(encode({ type: "text", content: text.text }));
        }
      }

      // Send citations after text
      if (allCitations.length > 0) {
        await writer.write(encode({ type: "citations", records: allCitations }));
      }

      await writer.write(encode({ type: "done" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await writer.write(encode({ type: "error", message }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
