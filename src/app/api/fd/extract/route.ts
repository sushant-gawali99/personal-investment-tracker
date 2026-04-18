import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import type { ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

const PROMPT = `These images show the front and back of a Fixed Deposit certificate/receipt. Extract all FD details and return a single JSON object with exactly these fields (use null for any field not found):

{
  "bankName": string,
  "fdNumber": string | null,
  "accountNumber": string | null,
  "principal": number,
  "interestRate": number,
  "tenureMonths": number,
  "startDate": "YYYY-MM-DD",
  "maturityDate": "YYYY-MM-DD",
  "maturityAmount": number | null,
  "interestType": "simple" | "compound",
  "compoundFreq": "monthly" | "quarterly" | "annually" | null,
  "maturityInstruction": "renew_principal_interest" | "renew_principal" | "payout" | null,
  "payoutFrequency": "on_maturity" | "monthly" | "quarterly" | "half_yearly" | "annually" | null,
  "nomineeName": string | null,
  "nomineeRelation": string | null
}

Rules:
- interestRate must be per annum percentage (e.g. 7.5 not 0.075)
- tenureMonths must be an integer (convert years to months if needed)
- dates must be in YYYY-MM-DD format
- If compounding frequency is not mentioned, default to "quarterly" for compound type
- maturityInstruction: "renew_principal_interest" = auto-renew with interest; "renew_principal" = auto-renew principal, payout interest; "payout" = credit to savings on maturity
- payoutFrequency: how interest is paid out. "on_maturity" for cumulative/reinvest FDs; monthly/quarterly/etc for non-cumulative payouts
- Renewal details and nominee are usually printed on the back side of the receipt
- Return ONLY the JSON, no explanation`;

const PROMPT_SINGLE = PROMPT.replace("These images show the front and back of a Fixed Deposit certificate/receipt.", "This image shows a Fixed Deposit certificate/receipt.");

async function fileToImageBlock(file: File): Promise<ImageBlockParam> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: base64,
    },
  };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const front = formData.get("front") as File | null;
  const back = formData.get("back") as File | null;

  if (!front) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  for (const file of [front, back].filter(Boolean) as File[]) {
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: `${file.name} exceeds 5 MB limit.` }, { status: 400 });
    if (!validTypes.includes(file.type)) return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, or WebP." }, { status: 400 });
  }

  try {
    const contentBlocks: (ImageBlockParam | TextBlockParam)[] = [];

    contentBlocks.push(await fileToImageBlock(front));
    if (back) contentBlocks.push(await fileToImageBlock(back));
    contentBlocks.push({ type: "text", text: back ? PROMPT : PROMPT_SINGLE });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract details from image." }, { status: 422 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ extracted });
  } catch (err) {
    console.error("Claude extraction failed:", err);
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
