"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

type Props = {
  fd: {
    id: string;
    bankName: string;
    principal: number;
    maturityDate: string;
    tenureMonths: number;
    interestRate: number;
    nomineeName: string | null;
    nomineeRelation: string | null;
    maturityInstruction: string | null;
    payoutFrequency: string | null;
  };
};

export function FDRenewForm({ fd }: Props) {
  const router = useRouter();
  const prevMaturity = fd.maturityDate.split("T")[0];

  const [startDate, setStartDate] = useState(prevMaturity);
  const [principal, setPrincipal] = useState(fd.principal.toString());
  const [interestRate, setInterestRate] = useState(fd.interestRate.toString());
  const [tenureMonths, setTenureMonths] = useState(fd.tenureMonths.toString());
  const [maturityDate, setMaturityDate] = useState("");
  const [maturityAmount, setMaturityAmount] = useState("");
  const [maturityInstruction, setMaturityInstruction] = useState(fd.maturityInstruction ?? "");
  const [payoutFrequency, setPayoutFrequency] = useState(fd.payoutFrequency ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/fd/${fd.id}/renewals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          maturityDate,
          principal: parseFloat(principal),
          interestRate: parseFloat(interestRate),
          tenureMonths: parseInt(tenureMonths),
          maturityAmount: maturityAmount ? parseFloat(maturityAmount) : null,
          maturityInstruction: maturityInstruction || null,
          payoutFrequency: payoutFrequency || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
      router.push(`/dashboard/fd/${fd.id}`);
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
      <section className="ab-card p-6 space-y-5">
        <div>
          <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Renewal Details</p>
          <p className="text-[13px] text-[#a0a0a5] mt-0.5">
            Record a new renewal period for <span className="font-semibold text-[#ededed]">{fd.bankName}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="ab-label">Renewal Date *</label>
            <DatePicker value={startDate} onChange={setStartDate} required />
          </div>
          <div>
            <label className="ab-label">Due Date (Maturity) *</label>
            <DatePicker value={maturityDate} onChange={setMaturityDate} required />
          </div>
          <div>
            <label className="ab-label">Deposit Amount (₹) *</label>
            <input type="number" min="1" step="0.01" className="ab-input mono" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
          </div>
          <div>
            <label className="ab-label">Rate of Interest (% p.a.) *</label>
            <input type="number" min="0.01" max="30" step="0.01" className="ab-input mono" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
          </div>
          <div>
            <label className="ab-label">Period (months) *</label>
            <input type="number" min="1" className="ab-input mono" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} required />
          </div>
          <div>
            <label className="ab-label">Maturity Amount (₹)</label>
            <input type="number" min="1" step="0.01" className="ab-input mono" value={maturityAmount} onChange={(e) => setMaturityAmount(e.target.value)} placeholder="Auto-calculated if blank" />
          </div>
          <div>
            <label className="ab-label">Maturity Instruction</label>
            <select className="ab-input" value={maturityInstruction} onChange={(e) => setMaturityInstruction(e.target.value)}>
              <option value="">Not specified</option>
              <option value="renew_principal_interest">Auto-renew principal + interest</option>
              <option value="renew_principal">Auto-renew principal, payout interest</option>
              <option value="payout">Credit to savings on maturity</option>
            </select>
          </div>
          <div>
            <label className="ab-label">Interest Payout Frequency</label>
            <select className="ab-input" value={payoutFrequency} onChange={(e) => setPayoutFrequency(e.target.value)}>
              <option value="">Not specified</option>
              <option value="on_maturity">On maturity (cumulative)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-yearly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
        </div>

        {error && (
          <div
            className="ab-card-flat px-3 py-2 text-[13px]"
            style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="ab-btn ab-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="ab-btn ab-btn-accent"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : (
              "Save Renewal"
            )}
          </button>
        </div>
      </section>
    </form>
  );
}
