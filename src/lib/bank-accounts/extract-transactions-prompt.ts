export interface PromptInputs {
  categoryNames: string[];
  extractedText: string | null;
}

export function buildSystemPrompt(inputs: PromptInputs): string {
  return `You are a bank-statement transaction extractor for a personal finance app.

Return ONLY a JSON object (no prose, no code fences). Schema:
{
  "statementPeriodStart": "YYYY-MM-DD" | null,
  "statementPeriodEnd":   "YYYY-MM-DD" | null,
  "transactions": [
    {
      "txnDate":        "YYYY-MM-DD",
      "valueDate":      "YYYY-MM-DD" | null,
      "description":    string,
      "amount":         number,
      "direction":      "debit" | "credit",
      "runningBalance": number | null,
      "bankRef":        string | null,
      "suggestedCategory": string | null
    }
  ]
}

Rules:
- Include EVERY transaction row, even small ones. Skip opening/closing balance lines and page totals.
- txnDate must be the transaction date, not the print/run date.
- DATE FORMAT: all dates in the statement are INDIAN format — day first, then
  month, then year (DD/MM/YYYY or DD-MM-YYYY or "05 Apr 2025"). NEVER interpret
  them as US month-first format.
    * "03/04/2025" → 3 April 2025 → output "2025-04-03" (NOT "2025-03-04")
    * "12-01-2025" → 12 January 2025 → output "2025-01-12"
    * "05 Apr 2025" → output "2025-04-05"
  If a value is genuinely ambiguous and neither form is an Indian date
  (e.g. month > 12 on the left), return null rather than guessing.
- amount is always POSITIVE. Use "direction" to distinguish debit vs credit.
- bankRef: UPI reference id, cheque number, or bank's internal txn id when present; else null.
- suggestedCategory MUST be exactly one of: ${inputs.categoryNames.join(", ")}, or null if none fits. No synonyms.
- Do not invent values. If unclear, return null for the field.
- Output the JSON object and nothing else.`;
}

export function buildUserText(extractedText?: string | null): string {
  if (extractedText && extractedText.trim().length > 0) {
    return `Extract all transactions from the statement text below.\n\n<statement>\n${extractedText}\n</statement>`;
  }
  return "Extract all transactions from this statement.";
}
