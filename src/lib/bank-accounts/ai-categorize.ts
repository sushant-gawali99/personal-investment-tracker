// src/lib/bank-accounts/ai-categorize.ts
//
// Asks Claude to group uncategorized transactions and suggest a short
// merchant pattern + category for each group. The result feeds the
// auto-rule-creation flow: each suggestion becomes a MerchantRule that
// retroactively matches every transaction containing that pattern.
import { anthropic } from "@/lib/anthropic";

export interface AiCategorySuggestion {
  /** Short uppercase substring to store as the MerchantRule pattern. */
  pattern: string;
  /**
   * Category name. If `isNewCategory` is true this is a brand-new label the
   * caller must create before linking the rule; otherwise it must exactly
   * match one of the existing categories passed in.
   */
  category: string;
  /** "expense" | "income" | "transfer" — required when isNewCategory is true. */
  categoryKind?: "expense" | "income" | "transfer";
  /** True when the suggestion proposes creating a new category. */
  isNewCategory?: boolean;
  /** Confidence 0-1. We drop anything below 0.6. */
  confidence: number;
  /** Optional human-readable merchant label (for logging, not stored). */
  merchant?: string | null;
}

export interface CategoryInput {
  name: string;
  kind: string; // "expense" | "income" | "transfer"
}

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJson(raw: string): unknown {
  const stripped = stripFences(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(stripped.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error(`AI returned malformed JSON: ${raw.slice(0, 300)}`);
  }
}

/**
 * Ask Claude to cluster a batch of normalised descriptions by merchant and
 * map each cluster to a category. We pass only the distinct descriptions —
 * Prisma-side `updateMany` will fan the result back to every matching txn.
 */
export async function suggestRulesFromDescriptions(
  descriptions: string[],
  categories: CategoryInput[],
): Promise<AiCategorySuggestion[]> {
  if (descriptions.length === 0) return [];

  const categoryList = categories
    .map((c) => `- ${c.name} (${c.kind})`)
    .join("\n");

  const system = `You help categorize Indian bank transactions (UPI, IMPS, NEFT, card, ATM).

You will receive a list of normalised transaction descriptions. Your job is to AGGRESSIVELY categorise every row you can identify — the user has many uncategorised transactions and wants maximum coverage. DO NOT be overly conservative.

EXISTING CATEGORIES (strongly prefer these):
${categoryList}

RULES:

1. COVERAGE IS THE PRIORITY. For EVERY description in the input, you should either:
   (a) emit a suggestion (preferred — even if you're only moderately confident), OR
   (b) skip it ONLY if it's a person-to-person transfer with no merchant context (e.g. "UPI/P2A/<name>" where <name> looks like an individual, or a bare "NEFT TRANSFER")
   Do NOT skip well-known merchant brands — ever. If you see Swiggy, Zepto, Amazon, Blinkit, Zudio, Zomato, etc., there MUST be a suggestion.

2. Pattern requirements — pick the SHORTEST brand prefix that is still distinctive:
   - 4-40 characters, UPPERCASE, no leading/trailing whitespace
   - uniquely identifies the merchant
   - CRITICAL: use the BRAND ROOT, not the full legal name. The pattern is used as a substring match (LIKE %PATTERN%) against every description — a short brand prefix will automatically cover all its variants.
     GOOD: "ZEPTO" (covers "Zepto", "Zeptonow", "Zepto Marketplace", "Zepto Bangalore")
     GOOD: "SWIGGY" (covers "Swiggy", "Swiggy Instamart", "Swiggy Bangalore")
     GOOD: "AMAZON" (covers "Amazon", "Amazon Pay", "Amazon Seller")
     GOOD: "BLINKIT" (covers "Blinkit", "Blinkit Grofers")
     BAD: "ZEPTO BANGALORE" (misses "Zeptonow")
     BAD: "SWIGGY BANGALORE" (misses "Swiggy Instamart")
     BAD: "AMAZON PAY INDIA" (misses plain "Amazon")
   - STRIP from patterns: city names (BANGALORE, MUMBAI, PUNE, DELHI), "INDIA", "PVT LTD", "PRIVATE LIMITED", "LLP", "ENTERPRISES", "TECHNOLOGIES", numeric suffixes, branch codes (e.g. "Z15").
   - EXCEPTION — keep two words only when a single word would be generic:
     "GOOGLE PLAY" (not "GOOGLE" — too generic; matches Google Cloud, Google Ads, etc.)
     "APPLE SERVICES" (not "APPLE")
   - NOT a generic token like "UPI", "PAYMENT", "TRANSFER", "P2M", "P2A", "NEFT", "IMPS"
   - NOT a rupee amount, date, or transaction reference number
   - WHEN VARIANTS OF THE SAME BRAND MAP TO DIFFERENT CATEGORIES, emit BOTH — the longer one wins because rules are applied longest-first. Example: "SWIGGY" → Food & Dining AND "SWIGGY INSTAMART" → Grocery. Emit the general rule too so plain "Swiggy" rows still get categorised.

3. Category assignment (Indian context). Prefer existing categories; fuzzy-match on intent:
   - CRED, credit card bill payments → "Credit Card Bill" (propose new if missing, kind=transfer)
   - Swiggy (not Instamart), Zomato, restaurants, cafes, "Cafe *", dhabas, food courts, hospitality → "Food & Dining"
   - BigBasket, Blinkit, Zepto, Zeptonow, Swiggy Instamart, DMart, local kirana, dairy, vegetable vendors, "Veg *" shops, "* Dugh" (dairy) → "Grocery"
   - Apollo, PharmEasy, 1mg, Netmeds, hospitals, clinics, labs, diagnostics, doctors, medicals → "Medical"
   - Uber, Ola, Rapido, IRCTC, MakeMyTrip, Goibibo, Yatra, metro, toll (FASTag), airlines → "Travel"
   - Petrol pumps (HP, IOC, BPCL, "Petroleum", "Fuel") → "Petrol"
   - Landlord names (if explicit), housing society, apartment, "Developers", "Builders", "rent" keywords → "Rent"
   - Amazon, Flipkart, Myntra, Ajio, Meesho, Zudio, Westside, H&M, Decathlon, Nykaa, general e-commerce/retail → "Shopping"
   - Netflix, Prime, Spotify, Hotstar, JioCinema, BookMyShow, gaming → "Entertainment"
   - Electricity boards, gas, Airtel, Jio, Vi, BSNL, broadband, DTH, water bills → "Utilities"
   - Salary credits, dividends, refunds, cashback → income kind
   - Self-transfers, EMIs, SIPs, mutual fund purchases, investment brokers (Zerodha, Groww, Upstox) → transfer kind

4. ONLY propose a new category if NONE of the existing categories fit. When you do, set "isNewCategory": true and provide:
   - a short, title-cased name (e.g. "Credit Card Bill", "Insurance", "Education")
   - "categoryKind" as "expense", "income", or "transfer"
   Do NOT create a new category just because the merchant is specific — e.g. "Swiggy" fits "Food & Dining".

5. Confidence calibration (use the FULL range — do not default to 0.5):
   - 0.95+ the merchant name is unambiguous (Amazon, Swiggy, Netflix, etc.)
   - 0.8-0.94 probable (generic-sounding merchant whose category is still clear from keywords)
   - 0.65-0.79 educated guess (some ambiguity but the best-guess category is reasonable)
   - below 0.5 — skip. Everything else should produce a suggestion.

6. Indian human names (e.g. "Rahul Kumar", "Atkare Sakharam Vishw", "Ramlakhan Kumar Mahto") are P2P — SKIP unless the description also contains a clear business indicator like "Hospitality", "Traders", "Stores", "Enterprises".

Return ONLY JSON in this exact shape:
{
  "suggestions": [
    { "pattern": "ZEPTO", "category": "Grocery", "confidence": 0.95, "merchant": "Zepto" },
    { "pattern": "AMAZON", "category": "Shopping", "confidence": 0.97, "merchant": "Amazon" },
    { "pattern": "CRED CLUB", "category": "Credit Card Bill", "categoryKind": "transfer", "isNewCategory": true, "confidence": 0.92, "merchant": "CRED" }
  ]
}`;

  const user = `Normalised descriptions to categorise:\n${descriptions
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n")}`;

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } } as never,
    ] as never,
    messages: [{ role: "user", content: user }],
  });
  const res = await stream.finalMessage();

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = parseJson(textBlock.text) as {
    suggestions?: AiCategorySuggestion[];
  };

  const allowed = new Set(categories.map((c) => c.name));
  return (parsed.suggestions ?? []).filter((s): s is AiCategorySuggestion => {
    if (
      !s ||
      typeof s.pattern !== "string" ||
      typeof s.category !== "string" ||
      typeof s.confidence !== "number" ||
      s.confidence < 0.6 ||
      s.pattern.trim().length < 4
    ) {
      return false;
    }
    if (s.isNewCategory) {
      // New-category suggestions must declare a kind and not collide with
      // an existing name (case-insensitive).
      const kind = s.categoryKind;
      if (kind !== "expense" && kind !== "income" && kind !== "transfer") {
        return false;
      }
      const lower = s.category.toLowerCase();
      for (const existing of allowed) {
        if (existing.toLowerCase() === lower) return false;
      }
      return true;
    }
    return allowed.has(s.category);
  });
}
