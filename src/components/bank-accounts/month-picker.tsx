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
    <div className="inline-flex items-center bg-[var(--surface-raised)] border border-[var(--border)] rounded-full p-1 gap-0.5">
      <button
        onClick={() => step(-1)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-[128px] sm:min-w-[140px] text-center text-[14px] font-semibold text-[var(--text-primary)] tracking-tight">
        {label}
      </span>
      <button
        onClick={() => step(1)}
        disabled={isCurrent}
        className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
