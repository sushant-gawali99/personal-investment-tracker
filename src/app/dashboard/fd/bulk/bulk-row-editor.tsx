"use client";

import { DatePicker } from "@/components/ui/date-picker";
import type { BulkRow, EditableFields } from "./bulk-state";

type Props = {
  row: BulkRow;
  onEditField: (field: keyof EditableFields, value: string) => void;
};

export function BulkRowEditor({ row, onEditField }: Props) {
  const f = row.edited;
  const v = (k: keyof EditableFields) => f[k] ?? "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="ab-label">Bank Name *</label>
        <input
          className="ab-input"
          value={v("bankName")}
          onChange={(e) => onEditField("bankName", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Principal (₹) *</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("principal")}
          onChange={(e) => onEditField("principal", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Interest Rate (% p.a.) *</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("interestRate")}
          onChange={(e) => onEditField("interestRate", e.target.value)}
          required
        />
      </div>
      <div>
        <label className="ab-label">Tenure (months)</label>
        <input
          type="number"
          min="0"
          className="ab-input mono"
          value={v("tenureMonths")}
          onChange={(e) => onEditField("tenureMonths", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Tenure (days)</label>
        <input
          type="number"
          min="0"
          className="ab-input mono"
          value={v("tenureDays")}
          onChange={(e) => onEditField("tenureDays", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Maturity Amount (₹)</label>
        <input
          type="number"
          step="0.01"
          className="ab-input mono"
          value={v("maturityAmount")}
          onChange={(e) => onEditField("maturityAmount", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Start Date *</label>
        <DatePicker value={v("startDate")} onChange={(val) => onEditField("startDate", val)} required />
      </div>
      <div>
        <label className="ab-label">Maturity Date *</label>
        <DatePicker value={v("maturityDate")} onChange={(val) => onEditField("maturityDate", val)} required />
      </div>
      <div>
        <label className="ab-label">Interest Type</label>
        <select
          className="ab-input"
          value={v("interestType") || "compound"}
          onChange={(e) => onEditField("interestType", e.target.value)}
        >
          <option value="compound">Compound</option>
          <option value="simple">Simple</option>
        </select>
      </div>
      {v("interestType") !== "simple" && (
        <div>
          <label className="ab-label">Compounding Frequency</label>
          <select
            className="ab-input"
            value={v("compoundFreq") || "quarterly"}
            onChange={(e) => onEditField("compoundFreq", e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      )}
      <div>
        <label className="ab-label">FD Number</label>
        <input
          className="ab-input"
          value={v("fdNumber")}
          onChange={(e) => onEditField("fdNumber", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Account Number</label>
        <input
          className="ab-input"
          value={v("accountNumber")}
          onChange={(e) => onEditField("accountNumber", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Maturity Instruction</label>
        <select
          className="ab-input"
          value={v("maturityInstruction")}
          onChange={(e) => onEditField("maturityInstruction", e.target.value)}
        >
          <option value="">Not specified</option>
          <option value="renew_principal_interest">Auto-renew principal + interest</option>
          <option value="renew_principal">Auto-renew principal, payout interest</option>
          <option value="payout">Credit to savings on maturity</option>
        </select>
      </div>
      <div>
        <label className="ab-label">Payout Frequency</label>
        <select
          className="ab-input"
          value={v("payoutFrequency")}
          onChange={(e) => onEditField("payoutFrequency", e.target.value)}
        >
          <option value="">Not specified</option>
          <option value="on_maturity">On maturity (cumulative)</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="half_yearly">Half-yearly</option>
          <option value="annually">Annually</option>
        </select>
      </div>
      <div>
        <label className="ab-label">Nominee Name</label>
        <input
          className="ab-input"
          value={v("nomineeName")}
          onChange={(e) => onEditField("nomineeName", e.target.value)}
        />
      </div>
      <div>
        <label className="ab-label">Nominee Relation</label>
        <input
          className="ab-input"
          value={v("nomineeRelation")}
          onChange={(e) => onEditField("nomineeRelation", e.target.value)}
        />
      </div>
    </div>
  );
}
