// src/components/bank-accounts/month-picker.tsx
"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  function step(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  }
  const label = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="inline-flex items-center bg-[#17171a] border border-[#2a2a2e] rounded-full p-1 gap-1">
      <button
        onClick={() => step(-1)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-[#a0a0a5] hover:bg-[#1c1c20] hover:text-[#ededed] transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[130px] sm:min-w-[150px] text-center text-[14px] font-semibold text-[#ededed] tracking-tight">
        {label}
      </span>
      <button
        onClick={() => step(1)}
        disabled={isCurrent}
        className="w-9 h-9 flex items-center justify-center rounded-full text-[#a0a0a5] hover:bg-[#1c1c20] hover:text-[#ededed] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
