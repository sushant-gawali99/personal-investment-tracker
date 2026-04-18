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
  "nomineeRelation": string | null,
  "renewalNumber": number | null,
  "priorPeriods": Array<{ "startDate": "YYYY-MM-DD" | null, "maturityDate": "YYYY-MM-DD" | null, "principal": number | null, "interestRate": number | null, "tenureMonths": number | null, "maturityAmount": number | null }> | null
}

Rules:
- interestRate must be per annum percentage (e.g. 7.5 not 0.075)
- tenureMonths must be an integer (convert years to months if needed)
- dates must be in YYYY-MM-DD format
- If compounding frequency is not mentioned, default to "quarterly" for compound type
- maturityInstruction: "renew_principal_interest" = auto-renew with interest; "renew_principal" = auto-renew principal, payout interest; "payout" = credit to savings on maturity
- payoutFrequency: how interest is paid out. "on_maturity" for cumulative/reinvest FDs; monthly/quarterly/etc for non-cumulative payouts
- Renewal details and nominee are usually printed or handwritten on the back side of the receipt — look carefully for handwritten annotations, checkboxes, stamps, or pen-filled fields
- Even if text is handwritten, faded, or partially legible, make your best effort to extract it

IMPORTANT — current-period fields:
- principal, interestRate, tenureMonths, startDate, maturityDate must describe the CURRENT (latest / most recent) active period of this FD
- If the back side shows a renewal table with entries (handwritten or printed), the LATEST renewal row is the current period — use its date of renewal as startDate, its due date as maturityDate, its period/amount/rate as tenureMonths/principal/interestRate
- Only if NO renewal has occurred, use the original opening date, original maturity date, and original amount/rate from the front side

renewalNumber — count of COMPLETED renewals only:
- 0 or null = this FD has never been renewed (only the original period exists)
- 1 = renewed ONCE (one entry in the renewal table)
- 2 = renewed twice (two entries in the renewal table)
- Do NOT count the original opening as a renewal. Count ONLY filled rows in the "Details of Renewal" / renewal table on the back. Tally marks, handwritten rows, or stamped entries each count as one renewal

priorPeriods — historical periods before the current one, in chronological order:
- If renewalNumber > 0, populate priorPeriods with exactly renewalNumber entries
- priorPeriods[0] = the ORIGINAL period from the front of the receipt (opening date → original maturity date, original amount/rate/tenure)
- priorPeriods[1..N-1] = intermediate renewals from the back-side renewal table, EXCLUDING the latest one (the latest is already captured in the top-level current-period fields)
- Example: if renewalNumber=1, priorPeriods has 1 entry = original. The single renewal row is the current period, captured at the top level.
- Example: if renewalNumber=2, priorPeriods has 2 entries = [original, first renewal]. The second (latest) renewal row is the current period.
- If renewalNumber is 0 or null, set priorPeriods to null
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
