"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/equity-mf/zerodha", label: "Zerodha", Icon: TrendingUp, desc: "Live equity & MF from Kite" },
  { href: "/dashboard/equity-mf/nj-india", label: "NJ India", Icon: PieChart, desc: "Upload MF valuation PDFs" },
];

export function EquityMFTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border)]">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all",
              active
                ? "bg-[var(--primary)]/10 text-white ring-1 ring-inset ring-[var(--primary)]/30 shadow-[0_0_0_1px_rgba(255,56,92,0.15)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            )}
          >
            <Icon size={14} strokeWidth={2.2} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
