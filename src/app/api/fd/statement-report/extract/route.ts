import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import type { FDReportData } from "@/lib/fd-statement-report/types";

type DocumentBlockParam = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

const PROMPT = `This is a bank account passbook or personal ledger PDF. Extract all Fixed Deposit related transactions and return a single JSON object.

FD transaction patterns to identify in the description/particulars column:
- "Int. FD-XXXXXX" or "INT FD-XXXXXX" or "INT ON FD XXXXX" → interest_payout for that FD
- "INT FD XXXXX MAT CLSD" → maturity_interest (interest credited at maturity)
- "MAT FD XXXXX CLSD" → maturity_principal (principal returned on natural maturity)
- "Transfer fr FD-XXXXXX" or "Transfer from FD-XXXXXX" or "TRF FR FD XXXXX" or similar transfer-from-FD patterns → maturity_principal (principal transferred out of FD on maturity or renewal)
- "FD NO XXXXX PRE MAT CLD INT" → premature_interest
- "FD NO XXXXX PRE MAT CLD" → premature_principal (principal on premature closure)
- Any other FD-related row → other

IMPORTANT: Any credit transaction where the description references an FD number and the amount is large (likely principal-sized, not just interest) should be classified as maturity_principal rather than other, even if the wording doesn't exactly match the patterns above.

Extract the FD number from each description. Group all transactions by FD number.

Return a JSON object with this exact shape:
{
  "bankName": string,
  "accountNumber": string | null,
  "accountHolderName": string | null,
  "statementFromDate": "YYYY-MM-DD" | null,
  "statementToDate": "YYYY-MM-DD" | null,
  "fds": [
    {
      "fdNumber": string,
      "transactions": [
        {
          "date": "YYYY-MM-DD",
          "description": string,
          "amount": number,
          "type": "interest_payout" | "maturity_principal" | "maturity_interest" | "premature_principal" | "premature_interest" | "other"
        }
      ],
      "totalInterest": number,
      "principalReturned": number | null,
      "closureType": "matured" | "premature" | "ongoing",
      "closureDate": "YYYY-MM-DD" | null
    }
  ]
}

Rules:
- bankName: institution name printed at the top of the document
- accountNumber: from "Account No:" field
- accountHolderName: from "Name:" field (primary account holder)
- statementFromDate/statementToDate: from the "FROM DATE / TO DATE" header fields, format YYYY-MM-DD
- For each transaction, amount comes from the CREDIT column (all FD payouts are credits)
- totalInterest: sum of amounts for types interest_payout + maturity_interest + premature_interest
- principalReturned: amount for maturity_principal or premature_principal (null if neither exists)
- closureType: "matured" if maturity_principal/maturity_interest rows exist; "premature" if premature_principal/premature_interest rows exist; "ongoing" if only interest_payout rows
- closureDate: the date of the maturity_principal or premature_principal transaction (null if ongoing)
- Include every FD found, even if only one transaction exists for it
- Return ONLY the JSON, no explanation`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const pdfFile = formData.get("pdfFile") as File | null;

  if (!pdfFile) {
    return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  }
  if (pdfFile.type !== "application/pdf") {
    return NextResponse.json({ error: "Expected a PDF file." }, { status: 400 });
  }
  if (pdfFile.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File exceeds 50 MB limit." }, { status: 400 });
  }

  try {
    const bytes = await pdfFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const docBlock: DocumentBlockParam = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [docBlock, { type: "text", text: PROMPT }],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract FD data from document." }, { status: 422 });
    }

    const data = JSON.parse(jsonMatch[0]) as FDReportData;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Statement extraction failed:", err);
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
