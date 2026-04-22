// src/components/bank-accounts/month-picker.tsx
"use client";
export function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  function step(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  }
  const label = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="flex items-center gap-2">
      <button className="ab-btn ab-btn-ghost" onClick={() => step(-1)}>‹</button>
      <span className="min-w-[140px] text-center">{label}</span>
      <button className="ab-btn ab-btn-ghost" onClick={() => step(1)}>›</button>
    </div>
  );
}
