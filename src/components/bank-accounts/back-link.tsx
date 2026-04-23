// src/components/bank-accounts/back-link.tsx
//
// Small back-navigation link used as the first element on every sub-page
// of the Bank Accounts module. Keeps the user oriented within a deep
// hierarchy (Overview → Transactions / Accounts / Imports / etc.).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({
  href = "/dashboard/bank-accounts",
  label = "Bank Accounts",
}: {
  /** Destination — defaults to the module overview. */
  href?: string;
  /** Text shown after the arrow. Should name the page we're returning to. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#a0a0a5] hover:text-[#ededed] transition-colors group"
    >
      <ArrowLeft
        size={13}
        className="transition-transform group-hover:-translate-x-0.5"
      />
      Back to {label}
    </Link>
  );
}
