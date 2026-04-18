"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Landmark, Settings, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/zerodha", label: "Zerodha" },
  { href: "/dashboard/fd", label: "Fixed Deposits" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0e0e11]/80 backdrop-blur-xl border-b border-[rgba(73,69,78,0.15)]">
      <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between">
        {/* Brand + tabs */}
        <div className="flex items-center gap-8">
          <span className="font-headline text-sm font-bold tracking-tight text-[#e4e1e6]">
            Personal Investment Tracker
          </span>

          <nav className="hidden sm:flex items-center gap-6">
            {TABS.map(({ href, label }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "font-headline font-bold text-sm tracking-tight pb-0.5 transition-colors duration-200",
                    active
                      ? "text-primary border-b-2 border-primary"
                      : "text-[#cbc4d0] hover:text-primary"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#cbc4d0] hover:text-[#ffafd7] hover:bg-[#ffafd7]/8 text-xs font-headline font-bold transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-1.5 rounded-lg text-[#cbc4d0] hover:text-primary transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-[rgba(73,69,78,0.15)] bg-[#0e0e11] px-4 py-3 space-y-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-headline font-bold tracking-tight transition-colors w-full",
                  active ? "text-primary bg-primary/10" : "text-[#cbc4d0] hover:text-primary"
                )}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-headline font-bold tracking-tight text-[#cbc4d0] hover:text-[#ffafd7] w-full transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
