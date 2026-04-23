"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/zerodha", label: "Zerodha" },
  { href: "/dashboard/fd", label: "Fixed Deposits" },
  { href: "/dashboard/bank-accounts", label: "Bank Accounts" },
  { href: "/dashboard/gold", label: "Gold" },
  { href: "/dashboard/settings", label: "Settings" },
];

interface Props {
  impersonatedUser?: string;
}

export function TopNav({ impersonatedUser }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);

  async function stopImpersonating() {
    setStopping(true);
    const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
    if (!res.ok) {
      setStopping(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <header className="sticky top-0 z-50 bg-[#17171a] border-b border-[#2a2a2e]">
      {impersonatedUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-400 text-[13px] font-medium">
            <Eye size={14} />
            <span>Viewing as <span className="font-semibold">{impersonatedUser}</span></span>
          </div>
          <button
            onClick={stopImpersonating}
            disabled={stopping}
            aria-label="Stop impersonating"
            className="text-amber-400 hover:text-amber-300 text-[12px] font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <X size={12} />
            Stop
          </button>
        </div>
      )}

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
            <span className="text-[18px] font-semibold tracking-tight text-[#ededed]">MyFolio</span>
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
                      ? "bg-[#ff385c]/10 text-white ring-1 ring-inset ring-[#ff385c]/25"
                      : "text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20]"
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
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>

          <button
            className="sm:hidden p-2 rounded-full text-[#ededed] hover:bg-[#1c1c20] transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sm:hidden border-t border-[#2a2a2e] bg-[#17171a] px-4 py-3 space-y-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                  active ? "bg-[#ff385c]/10 text-white ring-1 ring-inset ring-[#ff385c]/25" : "text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20]"
                )}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#1c1c20] w-full transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
