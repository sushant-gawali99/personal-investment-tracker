// src/components/bank-accounts/daily-heatmap.tsx
"use client";
import { CalendarDays } from "lucide-react";
import { formatINR, formatINRCompact } from "@/lib/format";

export function DailyHeatmap({ year, month, data, onDayClick }: {
  year: number; month: number;
  data: Record<string, number>;
  onDayClick: (dateIso: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const cells: Array<{ iso: string; value: number; day: number } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, value: data[iso] ?? 0, day: d });
  }

  const values = Object.values(data).filter((v) => v > 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);
  const activeDays = values.length;

  function intensityColor(value: number): string {
    if (value === 0) return "#1c1c20";
    const alpha = 0.15 + 0.75 * (value / max);
    return `rgba(255,56,92,${alpha.toFixed(3)})`;
  }

  return (
    <div className="ab-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[16px] font-semibold text-[#ededed] tracking-tight">Daily Spending</h3>
          <p className="text-[12px] text-[#a0a0a5] mt-0.5">
            {activeDays} active day{activeDays === 1 ? "" : "s"} · {formatINRCompact(total)} total
          </p>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(255,56,92,0.12)]">
          <CalendarDays size={15} className="text-[#ff385c]" />
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-[10px] text-[#6e6e73] text-center font-semibold tracking-wider">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (c === null) return <div key={i} />;
          const isToday = isCurrentMonth && c.day === today.getDate();
          const empty = c.value === 0;
          return (
            <button
              key={i}
              onClick={() => onDayClick(c.iso)}
              className="aspect-square rounded-[6px] text-[10px] font-semibold flex items-center justify-center transition-all hover:scale-110 hover:ring-2 hover:ring-white/20 focus:outline-none focus:ring-2 focus:ring-[#ff385c]"
              style={{
                background: intensityColor(c.value),
                color: empty ? "#6e6e73" : c.value / max > 0.4 ? "#fff" : "#ededed",
                border: isToday ? "1px solid #ededed" : "none",
              }}
              title={c.value > 0 ? `${c.iso}: ${formatINR(c.value)}` : `${c.iso}: no spending`}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {/* Intensity legend */}
      <div className="flex items-center gap-2 mt-4 text-[10px] text-[#6e6e73]">
        <span>Less</span>
        {[0, 0.2, 0.45, 0.7, 1].map((t, i) => (
          <span
            key={i}
            className="w-4 h-4 rounded-[4px]"
            style={{ background: t === 0 ? "#1c1c20" : `rgba(255,56,92,${0.15 + 0.75 * t})` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
