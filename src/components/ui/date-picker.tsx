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
          "w-full flex items-center justify-between gap-2 bg-[#0e0e11] ghost-border rounded-lg px-3 py-2.5 text-sm transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40",
          isValidDate ? "text-[#e4e1e6]" : "text-[#cbc4d0]",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <span>{isValidDate ? format(selected!, "dd MMM yyyy") : placeholder}</span>
        <CalendarDays size={14} className="text-[#cbc4d0] shrink-0" />
      </button>

      {/* hidden input for form required validation */}
      {required && <input tabIndex={-1} required value={value} onChange={() => {}} className="sr-only" />}

      {open && (
        <div className="absolute z-50 mt-1 bg-[#1b1b1e] border border-[rgba(73,69,78,0.3)] rounded-xl shadow-2xl p-3 left-0">
          <DayPicker
            mode="single"
            selected={isValidDate ? selected : undefined}
            defaultMonth={isValidDate ? selected : new Date()}
            onSelect={(date) => {
              if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); }
            }}
            classNames={{
              root: "text-xs",
              month_caption: "flex items-center justify-between px-1 mb-2",
              caption_label: "font-headline font-bold text-sm text-[#e4e1e6]",
              nav: "flex items-center gap-1",
              button_previous: "p-1 rounded-lg text-[#cbc4d0] hover:text-primary hover:bg-primary/10 transition-colors",
              button_next: "p-1 rounded-lg text-[#cbc4d0] hover:text-primary hover:bg-primary/10 transition-colors",
              weekdays: "flex mb-1",
              weekday: "w-8 text-center text-[10px] text-[#49454e] font-label uppercase",
              weeks: "space-y-1",
              week: "flex",
              day: "w-8 h-8 flex items-center justify-center",
              day_button: cn(
                "w-8 h-8 rounded-lg text-xs font-headline transition-colors",
                "text-[#cbc4d0] hover:bg-primary/10 hover:text-primary"
              ),
              selected: "bg-primary! text-[#00382f]! font-bold rounded-lg",
              today: "text-primary font-bold",
              outside: "opacity-30",
              disabled: "opacity-20 cursor-not-allowed",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />,
            }}
          />
        </div>
      )}
    </div>
  );
}
