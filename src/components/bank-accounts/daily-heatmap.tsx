// src/components/bank-accounts/daily-heatmap.tsx
"use client";
export function DailyHeatmap({ year, month, data, onDayClick }: {
  year: number; month: number;
  data: Record<string, number>;
  onDayClick: (dateIso: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: Array<{ iso: string; value: number } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, value: data[iso] ?? 0 });
  }
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Daily Spending</h3>
      <div className="grid grid-cols-7 gap-1">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-xs text-[#a0a0a5] text-center">{d}</div>)}
        {cells.map((c, i) => (
          c === null
            ? <div key={i} />
            : <button key={i} onClick={() => onDayClick(c.iso)}
                className="aspect-square rounded text-[10px] text-[#ededed]"
                style={{ background: c.value === 0 ? "#1a1a1e" : `rgba(255,56,92,${0.2 + 0.8 * c.value / max})` }}
                title={`${c.iso}: ₹${c.value.toLocaleString("en-IN")}`}>
                {c.iso.slice(-2)}
              </button>
        ))}
      </div>
    </div>
  );
}
