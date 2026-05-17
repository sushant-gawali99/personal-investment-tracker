"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/equity-mf", label: "Equity & MF" },
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
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border)",
      }}
    >
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

      <div className="max-w-[1440px] mx-auto px-8 h-[68px] flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[13px] font-bold"
              style={{ background: "linear-gradient(135deg, #ff385c 0%, #e00b41 100%)" }}
            >
              M
            </span>
            <span
              className="text-[18px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              MyFolio
            </span>
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
                      ? "bg-[#ff385c]/[0.12] ring-2 ring-inset ring-[#ff385c]/[0.35] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            <LogOut size={14} />
            Sign out
          </button>

          <button
            className="sm:hidden p-2 rounded-full transition-colors text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="sm:hidden px-4 py-3 space-y-1"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--surface-raised)",
          }}
        >
          {TABS.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                  active ? "bg-[#ff385c]/[0.12] ring-2 ring-inset ring-[#ff385c]/[0.35]" : ""
                )}
                style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
