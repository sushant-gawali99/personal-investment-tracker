import { readFileSync } from "node:fs";
import { extractPdfText } from "@/lib/bank-accounts/pdf-text";
import { parseStatementText } from "@/lib/bank-accounts/js-parser";

const pdf = readFileSync("src/lib/bank-accounts/__fixtures__/axis-march-2026.pdf");
(async () => {
  const { text } = await extractPdfText(pdf);
  const r = parseStatementText(text);
  const unique = new Set<string>();
  for (const t of r.transactions) unique.add(t.description);
  for (const s of Array.from(unique).slice(0, 50)) console.log(s);
})();
