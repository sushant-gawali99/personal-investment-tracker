"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
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
    <header className="sticky top-0 z-50 bg-white border-b border-[#ebebeb]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[13px] font-bold"
              style={{ background: "linear-gradient(135deg, #ff385c 0%, #e00b41 100%)" }}
            >
              M
            </span>
            <span className="text-[18px] font-semibold tracking-tight text-[#222222]">MyFolio</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {TABS.map(({ href, label }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm font-medium transition-colors",
                    active
                      ? "bg-[#f7f7f7] text-[#222222]"
                      : "text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7]"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>

          <button
            className="sm:hidden p-2 rounded-full text-[#222222] hover:bg-[#f7f7f7] transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sm:hidden border-t border-[#ebebeb] bg-white px-4 py-3 space-y-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                  active ? "bg-[#f7f7f7] text-[#222222]" : "text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7]"
                )}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6a6a6a] hover:text-[#222222] hover:bg-[#f7f7f7] w-full transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
