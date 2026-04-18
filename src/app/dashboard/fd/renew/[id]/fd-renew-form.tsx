"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const inputCls = "w-full bg-[#0e0e11] ghost-border rounded-lg px-3 py-2.5 text-sm text-[#e4e1e6] placeholder:text-[#cbc4d0] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";
const labelCls = "block text-[10px] text-[#cbc4d0] uppercase tracking-widest font-label mb-1.5";

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
    <form onSubmit={handleSubmit} className="bg-[#1b1b1e] ghost-border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Renewal Date *</label>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Due Date (Maturity) *</label>
          <input type="date" className={inputCls} value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Deposit Amount (₹) *</label>
          <input type="number" min="1" step="0.01" className={inputCls} value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Rate of Interest (% p.a.) *</label>
          <input type="number" min="0.01" max="30" step="0.01" className={inputCls} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Period (months) *</label>
          <input type="number" min="1" className={inputCls} value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Maturity Amount (₹)</label>
          <input type="number" min="1" step="0.01" className={inputCls} value={maturityAmount} onChange={(e) => setMaturityAmount(e.target.value)} placeholder="Auto-calculated if blank" />
        </div>
        <div>
          <label className={labelCls}>Maturity Instruction</label>
          <select className={inputCls} value={maturityInstruction} onChange={(e) => setMaturityInstruction(e.target.value)}>
            <option value="">Not specified</option>
            <option value="renew_principal_interest">Auto-renew principal + interest</option>
            <option value="renew_principal">Auto-renew principal, payout interest</option>
            <option value="payout">Credit to savings on maturity</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Interest Payout Frequency</label>
          <select className={inputCls} value={payoutFrequency} onChange={(e) => setPayoutFrequency(e.target.value)}>
            <option value="">Not specified</option>
            <option value="on_maturity">On maturity (cumulative)</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half-yearly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-[#ffafd7] bg-[#ffafd7]/5 border border-[#ffafd7]/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2.5 text-xs font-headline font-bold text-[#00382f] hover:bg-[#26fedc] disabled:opacity-60 transition-colors shadow-[0_0_12px_rgba(0,223,193,0.2)]"
        >
          {saving ? <><Loader2 size={12} className="animate-spin inline mr-1.5" />Saving…</> : "Save Renewal"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg ghost-border px-5 py-2.5 text-xs font-headline font-bold text-[#cbc4d0] hover:text-[#e4e1e6] hover:bg-[#1b1b1e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
