import type { LedgerConfig, TxnForExport } from "./tally-types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildTallyXml(txns: TxnForExport[], config: LedgerConfig): string {
  const mappingIndex = new Map(
    config.categoryMappings.map((m) => [m.categoryId ?? "__uncategorized__", m])
  );

  const vouchers = txns
    .map((txn) => {
      const key = txn.categoryId ?? "__uncategorized__";
      const mapping = mappingIndex.get(key);
      if (!mapping) throw new Error(`No ledger mapping for categoryId: ${txn.categoryId}`);

      const narration = escapeXml(txn.prettyDescription ?? txn.description);
      const bankLedger = escapeXml(config.bankLedgerName);
      const catLedger = escapeXml(mapping.tallyLedgerName);
      const date = formatDate(txn.txnDate);
      const amt = txn.amount.toFixed(2);
      const isDebit = txn.direction === "debit";

      const catDeemed = isDebit ? "No" : "Yes";
      const catAmount = isDebit ? `-${amt}` : amt;
      const bankDeemed = isDebit ? "Yes" : "No";
      const bankAmount = isDebit ? amt : `-${amt}`;

      return `        <VOUCHER REMOTEID="${txn.id}" VCHTYPE="${mapping.voucherType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${date}</DATE>
          <NARRATION>${narration}</NARRATION>
          <VOUCHERTYPENAME>${mapping.voucherType}</VOUCHERTYPENAME>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${catLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${catDeemed}</ISDEEMEDPOSITIVE>
            <AMOUNT>${catAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${bankLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${bankDeemed}</ISDEEMEDPOSITIVE>
            <AMOUNT>${bankAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
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
${vouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
