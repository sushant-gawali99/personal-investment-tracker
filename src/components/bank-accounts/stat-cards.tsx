// src/components/bank-accounts/stat-cards.tsx
export function StatCards({ spending, income, net, count }: { spending: number; income: number; net: number; count: number }) {
  const cards = [
    { label: "Total Spending", value: spending, tone: "text-red-400" },
    { label: "Total Income",   value: income,   tone: "text-green-500" },
    { label: "Net",            value: net,      tone: net >= 0 ? "text-green-500" : "text-red-400" },
    { label: "Transactions",   value: count,    tone: "text-[#ededed]", isCount: true as const },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="ab-card p-4">
          <div className="text-sm text-[#a0a0a5]">{c.label}</div>
          <div className={`text-2xl font-semibold mt-1 ${c.tone}`}>
            {c.isCount ? c.value : `₹${c.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </div>
        </div>
      ))}
    </div>
  );
}
