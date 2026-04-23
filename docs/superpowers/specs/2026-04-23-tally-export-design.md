# Tally ERP 9 XML Export — Design Spec

**Date:** 2026-04-23  
**Status:** Approved

---

## Overview

Users can export bank account transactions as a Tally ERP 9-compatible XML file from a dedicated export page. The export uses the same rich filter set as the transaction list. Before downloading, the user maps each transaction category to a Tally ledger name and voucher type.

---

## Architecture & Data Flow

```
User (browser)
  │
  ├─ Step 1: Filter UI  ──GET /api/bank-accounts/transactions?<filters>&pageSize=1──► total count
  │
  ├─ "Next" clicked ──GET /api/bank-accounts/export/tally/categories?<filters>──► unique categories
  │    └─ Returns: [{ categoryId, categoryName, kind }] + hasUncategorized: boolean
  │
  ├─ Step 2: Ledger mapping UI  (user fills in ledger names + voucher types)
  │
  └─ Download ──POST /api/bank-accounts/export/tally
                  Body: { filters, ledgerConfig }
                  ◄── XML file as attachment
```

### New API Routes

**`GET /api/bank-accounts/export/tally/categories?<filters>`**

- Accepts the same filter params as the transactions list
- Returns the distinct set of categories present in the matched transactions:
  ```ts
  { categories: { categoryId: string; categoryName: string; kind: CategoryKind }[]; hasUncategorized: boolean }
  ```
- Used to populate the ledger mapping table in Step 2

**`POST /api/bank-accounts/export/tally`**

- Accepts: `{ filters, ledgerConfig }` in request body
- Applies the same filter logic as `GET /api/bank-accounts/transactions` but fetches **all** matching rows (no pagination)
- Builds Tally ERP 9 XML in memory
- Returns `Content-Type: application/xml`, `Content-Disposition: attachment; filename="tally-export-YYYY-MM-DD.xml"`

### `ledgerConfig` shape

```ts
type VoucherType = "Payment" | "Receipt" | "Contra" | "Journal";

interface LedgerConfig {
  bankLedgerName: string;  // defaults to account label; "Multiple Accounts" if cross-account export
  categoryMappings: {
    categoryId: string | null;  // null = uncategorized transactions
    tallyLedgerName: string;
    voucherType: VoucherType;
  }[];
}
```

---

## UI — Two-Step Export Page

**Route:** `/dashboard/bank-accounts/export/tally`  
**Navigation:** linked from the bank accounts overview nav

### Step 1: Filters

Mirrors the transaction list filter bar:

| Filter | Input type |
|--------|-----------|
| Account | Dropdown (single or "All accounts") |
| Date range | From / To date pickers |
| Direction | Radio — All / Debit / Credit |
| Category | Multi-select |
| Amount range | Min / Max number inputs |
| Text search | Description search input |

- A live badge shows **"X transactions matched"** (debounced, calls existing transactions API with `pageSize=1` to read `total`)
- "Next: Configure Ledgers →" button is disabled when count = 0

### Step 2: Ledger Mapping

**Bank Ledger Name** — text input at the top, pre-filled with:
- The selected account's label (if a single account is selected)
- `"Multiple Accounts"` (if "All accounts" is selected) — user must fill this in

**Category mapping table** — one row per unique category in the matched transactions, plus one "Uncategorized" row if any transactions have no category:

| Column | Details |
|--------|---------|
| Category | Category name + kind badge (expense / income / transfer) |
| Tally Ledger Name | Text input, required |
| Voucher Type | Dropdown: Payment, Receipt, Contra, Journal |

- "Download XML" button disabled until all ledger name inputs are non-empty
- Shows *"X transactions will be exported"* above the download button

**Filter change guard:** If the user clicks "← Back to Filters" from Step 2, a confirmation dialog warns: *"Going back will reset your ledger mapping. Continue?"* Mappings are only reset if the user confirms; cancelling keeps them on Step 2.

---

## Tally ERP 9 XML Format

One `<VOUCHER>` per transaction, all wrapped in a single `<TALLYMESSAGE>`:

```xml
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">

          <VOUCHER REMOTEID="txn_abc123" VCHTYPE="Payment" ACTION="Create"
                   OBJVIEW="Accounting Voucher View">
            <DATE>20240115</DATE>
            <NARRATION>Zepto Groceries</NARRATION>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Food &amp; Dining</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-500.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>HDFC Savings</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>500.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>

        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

### Field Mapping Rules

| XML Field | Source |
|-----------|--------|
| `REMOTEID` | Transaction `id` — prevents duplicate imports in Tally |
| `VCHTYPE` / `VOUCHERTYPENAME` | User-selected voucher type for the transaction's category |
| `DATE` | `txnDate` formatted as `YYYYMMDD` (no separators) |
| `NARRATION` | `prettyDescription` if set, otherwise `description` |
| Category ledger `LEDGERNAME` | `tallyLedgerName` from `categoryMappings` |
| Bank ledger `LEDGERNAME` | `bankLedgerName` from `ledgerConfig` |

### Amount & Sign Convention

For **debit** transactions (money leaving the account):
- Category ledger: `ISDEEMEDPOSITIVE=No`, `AMOUNT=-<amount>`
- Bank ledger: `ISDEEMEDPOSITIVE=Yes`, `AMOUNT=<amount>`

For **credit** transactions (money entering the account):
- Category ledger: `ISDEEMEDPOSITIVE=Yes`, `AMOUNT=<amount>`
- Bank ledger: `ISDEEMEDPOSITIVE=No`, `AMOUNT=-<amount>`

### XML Escaping

All user-provided strings (ledger names, narration) are escaped:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`

---

## Error Handling

### API

| Condition | Response |
|-----------|----------|
| Filters match 0 transactions | 400 — "No transactions match the selected filters" |
| A matched category has no entry in `categoryMappings` | 400 — lists missing category names |
| Missing `bankLedgerName` | 400 — "Bank ledger name is required" |

### UI

| Condition | Behaviour |
|-----------|-----------|
| Count = 0 | "Next" button disabled; message: "No transactions match these filters" |
| Any ledger name empty | "Download XML" button disabled |
| Filters changed after reaching Step 2 | Confirmation dialog: "Changing filters will reset your ledger mapping. Continue?" |

---

## Out of Scope

- Tally Prime support (separate XML schema — future feature)
- Saving/reusing ledger mapping presets
- Scheduled or automated exports
- CSV / Excel export (separate feature)
