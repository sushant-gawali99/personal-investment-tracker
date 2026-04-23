// src/lib/bank-accounts/pretty-description.ts
//
// Turns opaque bank-statement strings into something a human can read at a
// glance. Runs purely client-side on the raw `description` field — no schema
// or DB changes. Used by the transactions list and the top-merchants card.
//
// Input format examples (Axis):
//   UPI/P2M/237794180606/Google Asia Pacific P/Sold b/AXIS BANK
//   UPI/P2A/398187233592/Mr Sushant Anant Gawa/Sent u/State Bank Of India
//   IMPS/P2A/606140940015/SushantGawali/X5077 21/ICICIBANKLTD/
//
// Output: a structured object with a clean merchant name, method, counterparty
// bank, and the original ref for debugging.

export type TxnMethod =
  | "UPI"
  | "IMPS"
  | "NEFT"
  | "RTGS"
  | "POS"
  | "ATM"
  | "Cheque"
  | "Salary"
  | "Interest"
  | "Charges"
  | "Transfer"
  | "Other";

export interface PrettyDescription {
  merchant: string;
  /** High-level transfer method (UPI, IMPS, POS, etc.). */
  method: TxnMethod | null;
  /** UPI sub-type (P2M = merchant, P2A = person). */
  subMethod: "P2M" | "P2A" | null;
  /** Counterparty bank if present in the raw string (Axis statements include it). */
  counterBank: string | null;
  /** Numeric reference id — useful for disputes, shown on hover/tooltip. */
  ref: string | null;
  /** Transfer direction inferred from description text: "to" = outgoing, "from" = incoming. */
  transferDir: "to" | "from" | null;
  /** The untouched raw description, for debugging + tooltip fallback. */
  raw: string;
}

// ─── Known-merchant canonicalisation ──────────────────────────────────────
// Bank statements truncate merchant names to ~20 chars, so "Zepto Marketplace
// Pri" and "Zepto" both appear. Collapse both to a canonical name.
const MERCHANT_CANON: Array<[RegExp, string]> = [
  [/\bswiggy(\s*limited)?\b/i, "Swiggy"],
  [/\bzomato(\s*(ltd|limited))?\b/i, "Zomato"],
  [/\bzepto(\s*marketplace.*)?\b/i, "Zepto"],
  [/\bblinkit\b/i, "Blinkit"],
  [/\bamazon\s*pay\s*grocer/i, "Amazon Pay Groceries"],
  [/\bamazon(\s*(india|pay))?\b/i, "Amazon"],
  [/\bflipkart\b/i, "Flipkart"],
  [/\bmyntra\b/i, "Myntra"],
  [/\bmeesho\b/i, "Meesho"],
  [/\bcred\b/i, "CRED"],
  [/\bgoogle\s*asia\s*pacific/i, "Google Play"],
  [/\bgoogle\s*(play|india)\b/i, "Google"],
  [/\bgoogle\s*pay/i, "Google Pay"],         // also catches "Google Payuti" (bank code fused)
  [/\bgoogle\s+p\b/i, "Google Pay"],         // SBI truncates "Google Pay" to "Google P"
  [/\bikea\s*india/i, "IKEA"],
  [/\bbarbeque\s*nation/i, "Barbeque Nation"],
  [/\bstar\s*bazaar/i, "Star Bazaar"],
  [/\bsahyadri\s*hospitals?/i, "Sahyadri Hospital"],
  [/\bapollo\s*(hospitals?|pharmacy)/i, "Apollo"],
  [/\bola(\s*cabs?)?\b/i, "Ola"],
  [/\buber(\s*india)?\b/i, "Uber"],
  [/\bbookmyshow\b/i, "BookMyShow"],
  [/\bmakemytrip\b/i, "MakeMyTrip"],
  [/\birctc\b/i, "IRCTC"],
  [/\bnetflix\b/i, "Netflix"],
  [/\bspotify\b/i, "Spotify"],
  [/\bairtel\b/i, "Airtel"],
  [/\bjio\b/i, "Jio"],
  [/\bvi\s*(?:-|\s)\s*vodafone/i, "Vi"],
  [/\btata\s*power/i, "Tata Power"],
  [/\binnovative\s*retail\s*con/i, "Reliance Retail"],
  [/\bmatoshree\s*medico/i, "Matoshree Medico"],
  [/\balyssum\s*developers?/i, "Alyssum Developers"],
  [/\bhealthians\b/i, "Healthians"],
  [/\bfederal\s*one/i, "Federal One"],
];

// Words that should always stay uppercase in Title Case output.
const ACRONYMS = new Set([
  "IKEA", "CRED", "HDFC", "ICICI", "SBI", "UPI", "NEFT", "IMPS", "RTGS",
  "ATM", "POS", "OTP", "EMI", "NSDL", "CDSL", "LPG", "LLP", "LTD", "PVT",
  "DPS", "MRI", "DNA", "AC", "BMS", "USA", "UK", "UAE", "TV", "PC", "USB",
  "NRI", "GST", "PAN", "IFSC", "UPI", "POS", "ATM",
]);

// Honorifics/noise to strip from the start of person names.
const HONORIFICS = /^(mr|mrs|ms|dr|shri|smt|mr\.|mrs\.)\s+/i;

// ─── Bank-name normalisation ──────────────────────────────────────────────
const BANK_CANON: Array<[RegExp, string]> = [
  [/\bax[iy]x(\s*bank)?\b/i, "Axis Bank"],  // SBI's "axix"/"axiyx" typo
  [/\baxb\b/i, "Axis Bank"],               // SBI's "axb" abbreviation
  [/\butib\b/i, "Axis Bank"],              // Axis Bank IFSC prefix used in UPI slot
  [/\bhdfc(\s*bank(\s*ltd)?)?\b/i, "HDFC Bank"],
  [/\bicici(\s*bank(\s*ltd)?)?\b/i, "ICICI Bank"],
  [/\bsbi\b|\bstate\s*bank(\s*of\s*india)?\b/i, "SBI"],
  [/\bkotak(\s*mahindra)?(\s*bank)?\b/i, "Kotak"],
  [/\byes\s*bank(\s*(ltd|limited))?(\s*ybs)?\b/i, "Yes Bank"],
  [/\bidfc(\s*first)?(\s*bank)?\b/i, "IDFC First"],
  [/\bbank\s*of\s*baroda\b/i, "Bank of Baroda"],
  [/\bstandard\s*chartered\b/i, "Standard Chartered"],
  [/\bindusind\s*bank(\s*(ltd|limited))?\b/i, "IndusInd"],
  [/\bnsdl\s*payments?\s*bank\b/i, "NSDL Payments Bank"],
];

function canonicalBank(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  for (const [rx, name] of BANK_CANON) if (rx.test(trimmed)) return name;
  return titleCase(trimmed);
}

// ─── Title-case helper ────────────────────────────────────────────────────
/** Convert a raw name to Title Case, preserving acronyms and merchant canon. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      // Keep all-punctuation tokens as-is.
      if (!/[a-z]/i.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Apply canonical-merchant dictionary, falling back to Title Case. */
function canonicalMerchant(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  for (const [rx, name] of MERCHANT_CANON) if (rx.test(trimmed)) return name;
  const stripped = trimmed.replace(HONORIFICS, "");
  return titleCase(stripped);
}

// ─── Main parser ──────────────────────────────────────────────────────────
/**
 * Prettify a single bank-statement description.
 *
 * Heuristics, in order:
 *   1. UPI / IMPS with the Axis 5-slot format → pull slot 4 as merchant, last
 *      slot as bank, slot 2 as sub-method.
 *   2. NEFT / RTGS with slot format → similar.
 *   3. POS / ATM prefixes → strip card digits, take the rest as merchant.
 *   4. Known descriptive keywords (SALARY, INTEREST, CHARGES, GST) → label it.
 *   5. Fallback → just Title Case the whole string.
 */
/** Infer transfer direction from description prefix keywords and UPI direction codes. */
function detectTransferDir(s: string): "to" | "from" | null {
  // SBI prefix: "Wdl" = withdrawal = money going out (to someone)
  //             "Dep" = deposit    = money coming in (from someone)
  if (/^wdl\b/i.test(s)) return "to";
  if (/^dep\b/i.test(s)) return "from";
  // UPI direction codes embedded in the description
  if (/\bUPI\/i?dr\b/i.test(s)) return "to";
  if (/\bUPI\/i?cr\b/i.test(s)) return "from";
  // "By Transfer" / "To Transfer" patterns
  if (/^by\s+(transfer|tfr)\b/i.test(s)) return "from";
  if (/^to\s+(transfer|tfr)\b/i.test(s)) return "to";
  return null;
}

export function prettifyDescription(raw: string): PrettyDescription {
  const base: PrettyDescription = {
    merchant: raw,
    method: null,
    subMethod: null,
    counterBank: null,
    ref: null,
    transferDir: null,
    raw,
  };
  if (!raw) return { ...base, merchant: "" };

  const trimmed = raw.trim();
  base.transferDir = detectTransferDir(trimmed);

  // ── UPI / IMPS slot-separated format (Axis) ──────────────────
  // UPI/P2M/237794180606/Google Asia Pacific P/Sold b/AXIS BANK
  // (\d*) — tolerates empty ref slot for pre-normalised inputs where
  // the 10+ digit reference has been stripped by normalizeDescription.
  const upiMatch = trimmed.match(
    /^(UPI|IMPS)\/(P2M|P2A)\/(\d*)\/([^/]*)\/([^/]*)\/?(.*)$/i,
  );
  if (upiMatch) {
    const [, method, sub, ref, merchantRaw, , bankRaw] = upiMatch;
    return {
      ...base,
      method: method.toUpperCase() as "UPI" | "IMPS",
      subMethod: sub.toUpperCase() as "P2M" | "P2A",
      ref,
      merchant: canonicalMerchant(merchantRaw) || "Unknown",
      counterBank: canonicalBank(bankRaw),
    };
  }

  // ── SBI-style UPI embedded mid-string ────────────────────────
  // "Wdl Tfr Upi/dr/608386283125/jyotiram/ Sury/7387993273/uber"
  // "Dep Tfr Upi/cr/420831234567/Sushant Gawali/sushant@upi/SBI"
  // UPI sits inside a longer prefix (Wdl Tfr / Dep Tfr etc.).
  // Direction codes seen in the wild: dr, cr, idr (immediate debit), icr, p2p, etc.
  // Separator after the ref can be "/" (normal) or " " (some SBI PDFs run ref+name together).
  const sbiUpiMatch = trimmed.match(/\bUPI\/([a-z]{1,4})\/(\d*)(?:\/|\s+)(.+)/i);
  if (sbiUpiMatch) {
    const [, dir, ref, rest] = sbiUpiMatch;
    // Strip trailing branch address: "At 07339 University Road (pune)" or "mand 009769... At 07339..."
    const cleanRest = rest.replace(/\s+At\s+\d[\w\s,.()\-]*$/i, "").trim();
    // Split remaining slots; discard:
    //   • pure-numeric tokens (phone/account numbers)
    //   • near-numeric tokens — 8+ chars where ≥80% are digits (OCR noise like "73879932t3")
    //   • short mandate/noise tokens ("mand", single letters used as bank codes)
    //   • VPA handles (contain @)
    function isNumericish(s: string): boolean {
      if (/^\d+$/.test(s)) return true;
      if (s.length >= 8 && (s.replace(/\D/g, "").length / s.length) >= 0.8) return true;
      return false;
    }
    const parts = cleanRest.split("/").map((p) => p.trim()).filter(
      (p) => p && !isNumericish(p) && !p.includes("@") && !/^mand\b/i.test(p) && p.length > 1,
    );
    // Try each slot for a known-merchant canon hit (e.g. "uber", "zomato" in later slots).
    // If nothing hits, fall back to the FIRST slot only — joining all slots pulls in bank
    // codes like "uti", "arup", "upi" that appear as junk in SBI's middle slots.
    let merchant = "UPI Transfer";
    let canonHit = false;
    for (const part of parts) {
      for (const [rx, name] of MERCHANT_CANON) {
        if (rx.test(part)) { merchant = name; canonHit = true; break; }
      }
      if (canonHit) break;
    }
    if (!canonHit) {
      const first = parts[0] ?? "";
      merchant = canonicalMerchant(first) || titleCase(first) || "UPI Transfer";
    }
    return {
      ...base,
      method: "UPI",
      subMethod: dir.toLowerCase() === "cr" ? "P2A" : "P2A",
      ref: ref || null,
      merchant,
    };
  }

  // ── SBI-style IMPS embedded mid-string ───────────────────────
  // "Dep Tfr Imps/607694998379/axix-xx200-ravindra/othersrdd"
  // Format: Imps/{ref}/{bank}-{masked_acct}-{name}/{category}
  const sbiImpsMatch = trimmed.match(/\bIMPS\/(\d+)\/(.+)/i);
  if (sbiImpsMatch) {
    const [, ref, rest] = sbiImpsMatch;
    // First slash-slot is "{bank}-{masked_acct}-{name}"; subsequent slots are
    // SBI category codes (e.g. "othersrdd") — ignore them.
    const firstSlot = rest.split("/")[0];
    const subParts = firstSlot.split("-").map((p) => p.trim()).filter(
      (p) =>
        p &&
        !/^\d+$/.test(p) &&          // not pure numbers
        !/^[xX]{2,}\d*$/.test(p) &&  // not masked account like "xx200"
        !/^others/i.test(p),         // not SBI category prefix "othersrdd"
    );
    // First sub-part tends to be the bank code; remaining is the name.
    const [maybeBankCode, ...nameParts] = subParts;
    const bankStr = maybeBankCode ?? "";
    const resolvedBank = canonicalBank(bankStr);
    // If it resolved to a known bank, keep it as counterBank; otherwise fold it into the name.
    const nameRaw = (resolvedBank ? nameParts : [bankStr, ...nameParts]).join(" ");
    return {
      ...base,
      method: "IMPS",
      ref,
      merchant: canonicalMerchant(nameRaw) || "IMPS Transfer",
      counterBank: resolvedBank,
    };
  }

  // ── SBI internal transfer "Frm {acct} To {acct} [{code}/]{name}" ──
  // "Dep Tfr Int Trf Frm 4381609104 To 10198755734 Dcpf/ravindra Diwakar D At 07339"
  // "Dep Tfr Int Trf Frm 4480023697 To 10198755734 Ravindra Diwakar D At 07339 ..."
  // The payment-mode code (Dcpf, Neft, etc.) before the slash is optional.
  const sbiInternalMatch = trimmed.match(/\bFrm\s+\d+\s+To\s+\d+\s+(?:[A-Za-z]+\/)?([A-Za-z][A-Za-z\s]{1,50})/i);
  if (sbiInternalMatch) {
    let name = sbiInternalMatch[1].trim();
    name = name.replace(/\s+D\s+At\b.*/i, "").replace(/\s+[A-Z]\s*$/, "").trim();
    return {
      ...base,
      method: "Transfer",
      merchant: canonicalMerchant(name) || name,
    };
  }

  // ── SBI plain transfer "Of Mr./Ms." ──────────────────────────
  // "Dep Tfr 00418160911146 Of Mr. Ravindra Diwakar D At 07339"
  // "Dep Tfr Int Trf Frm 43930368794 Of Mr. Ravindra Diwakar D At 07339 University Road (pune)"
  // No end-anchor — branch address may follow the "At {code}" portion.
  const ofPersonMatch = trimmed.match(/\bOf\s+(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+([A-Za-z][A-Za-z\s.]{1,50})/i);
  if (ofPersonMatch) {
    let name = ofPersonMatch[1].trim();
    // Strip trailing branch info: "D At 07339 University Road (pune)" or just "D At 07339"
    name = name.replace(/\s+D\s+At\b.*/i, "").replace(/\s+At\b\s+\d.*/i, "").trim();
    // Strip lone trailing initial "D" (middle-name initial SBI appends)
    name = name.replace(/\s+[A-Z]\s*$/, "").trim();
    const methodHint: TxnMethod =
      /\bNEFT\b/i.test(trimmed) ? "NEFT" :
      /\bRTGS\b/i.test(trimmed) ? "RTGS" :
      /\bIMPS\b/i.test(trimmed) ? "IMPS" : "Transfer";
    return {
      ...base,
      method: methodHint,
      merchant: canonicalMerchant(name) || name,
    };
  }

  // ── NEFT / RTGS format ────────────────────────────────────────
  // NEFT-HDFC0000123-JOHN DOE-REF123
  const neftMatch = trimmed.match(/^(NEFT|RTGS)[-\s/](.+)$/i);
  if (neftMatch) {
    const [, method, rest] = neftMatch;
    // Take the longest alphabetic chunk as the merchant/counterparty name.
    const parts = rest.split(/[-/]/).map((p) => p.trim()).filter(Boolean);
    const namePart = parts.find((p) => /[a-z]{3,}/i.test(p) && !/^[A-Z]{4}\d{7}$/.test(p)) ?? parts[0] ?? "";
    const refPart = parts.find((p) => /^\d{6,}$/.test(p));
    return {
      ...base,
      method: method.toUpperCase() as "NEFT" | "RTGS",
      merchant: canonicalMerchant(namePart) || method.toUpperCase(),
      ref: refPart ?? null,
    };
  }

  // ── POS / card swipe ─────────────────────────────────────────
  // POS 1234XXXXXX5678 AMAZON IN MUMBAI
  const posMatch = trimmed.match(/^POS[\s/-]+\S*\s+(.+?)(?:\s+[A-Z]{2,3}\s+[A-Z]+)?$/i);
  if (posMatch) {
    return {
      ...base,
      method: "POS",
      merchant: canonicalMerchant(posMatch[1]) || "Card Purchase",
    };
  }

  // ── ATM withdrawal ───────────────────────────────────────────
  if (/^ATM/i.test(trimmed)) {
    const loc = trimmed.replace(/^ATM[\s/-]*(WDL|WD)?[\s/-]*\d*[\s/-]*/i, "").trim();
    return {
      ...base,
      method: "ATM",
      merchant: loc ? `ATM — ${titleCase(loc)}` : "ATM Withdrawal",
    };
  }

  // ── Cheque ───────────────────────────────────────────────────
  if (/\bCHQ|CHEQUE|CHQ\s*DEP/i.test(trimmed)) {
    return { ...base, method: "Cheque", merchant: "Cheque" };
  }

  // ── Salary / credit descriptors ──────────────────────────────
  if (/\bSAL(ARY)?\b/i.test(trimmed)) {
    const afterSal = trimmed.replace(/.*\bSAL(ARY)?\b/i, "").trim();
    return {
      ...base,
      method: "Salary",
      merchant: afterSal ? canonicalMerchant(afterSal) : "Salary Credit",
    };
  }

  // ── Interest / charges ───────────────────────────────────────
  if (/INT(EREST)?\.?\s*CREDIT|INT\.?\s*PD/i.test(trimmed)) {
    return { ...base, method: "Interest", merchant: "Interest Credit" };
  }
  if (/\bCHG|CHARGE|GST|FEE\b/i.test(trimmed) && trimmed.length < 60) {
    return { ...base, method: "Charges", merchant: titleCase(trimmed) };
  }

  // ── Fallback: Title Case the whole string ───────────────────
  return { ...base, merchant: titleCase(trimmed) || trimmed };
}

// ─── Public helpers ───────────────────────────────────────────────────────
/** Short method code for chip display. */
export function methodChipLabel(m: TxnMethod | null): string | null {
  return m;
}

/** Tailwind-compatible colour class for each method. */
export function methodChipClass(m: TxnMethod | null): string {
  switch (m) {
    case "UPI":      return "ab-chip-info";
    case "IMPS":
    case "NEFT":
    case "RTGS":
    case "Transfer": return "ab-chip-info";
    case "POS":      return "ab-chip-warning";
    case "ATM":      return "ab-chip-warning";
    case "Salary":   return "ab-chip-success";
    case "Interest": return "ab-chip-success";
    case "Charges":  return "ab-chip-error";
    case "Cheque":   return "";
    default:         return "";
  }
}
