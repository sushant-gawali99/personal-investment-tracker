"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, required, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const isValidDate = selected && isValid(selected);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-white border border-[#c1c1c1] rounded-lg px-3.5 py-3 text-[14px] transition-all",
          "focus:outline-none focus:border-[#222222] focus:shadow-[0_0_0_1px_#222222]",
          isValidDate ? "text-[#222222]" : "text-[#929292]",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <span>{isValidDate ? format(selected!, "dd MMM yyyy") : placeholder}</span>
        <CalendarDays size={15} className="text-[#6a6a6a] shrink-0" />
      </button>

      {required && <input tabIndex={-1} required value={value} onChange={() => {}} className="sr-only" />}

      {open && (
        <div className="absolute z-50 mt-2 bg-white border border-[#ebebeb] rounded-xl shadow-[rgba(0,0,0,0.08)_0px_4px_12px,rgba(0,0,0,0.1)_0px_4px_8px] p-3 left-0">
          <DayPicker
            mode="single"
            selected={isValidDate ? selected : undefined}
            defaultMonth={isValidDate ? selected : new Date()}
            onSelect={(date) => {
              if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); }
            }}
            classNames={{
              root: "text-[13px]",
              month_caption: "flex items-center justify-between px-1 mb-2",
              caption_label: "font-semibold text-[14px] text-[#222222]",
              nav: "flex items-center gap-1",
              button_previous: "p-1.5 rounded-full text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7] transition-colors",
              button_next: "p-1.5 rounded-full text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7] transition-colors",
              weekdays: "flex mb-1",
              weekday: "w-9 text-center text-[11px] text-[#929292] font-semibold uppercase",
              weeks: "space-y-1",
              week: "flex",
              day: "w-9 h-9 flex items-center justify-center",
              day_button: cn(
                "w-9 h-9 rounded-full text-[13px] font-medium transition-colors",
                "text-[#222222] hover:bg-[#f7f7f7]"
              ),
              selected: "bg-[#222222]! text-white! font-semibold rounded-full",
              today: "text-[#ff385c] font-bold",
              outside: "opacity-40",
              disabled: "opacity-25 cursor-not-allowed",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />,
            }}
          />
        </div>
      )}
    </div>
  );
}
