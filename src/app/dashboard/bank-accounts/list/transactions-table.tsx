"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Link2,
  Pencil,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";
import { prettifyDescription, methodChipClass } from "@/lib/bank-accounts/pretty-description";
import { DatePicker } from "@/components/ui/date-picker";

interface Row {
  id: string;
  txnDate: string;
  description: string;
  prettyDescription: string | null;
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; label: string };
  notes: string | null;
  fdId: string | null;
  fd: { id: string; bankName: string; fdNumber: string | null; accountNumber: string | null } | null;
  /** Real running balance after this transaction (single-account view only). */
  balanceAfter: number | null;
}

export function TransactionsTable({
  accounts, categories,
}: { accounts: { id: string; label: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [page, setPage] = useState(Number(sp.get("page") ?? "1"));
  const [loading, setLoading] = useState(true);
  // Which row's category is in edit mode. Default: none — categories are
  // read-only until the user explicitly clicks the pencil to avoid
  // accidental re-categorisation of large lists.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(sp.get("q") ?? "");
  // Sync searchInput when q changes externally (e.g. "Clear all filters").
  useEffect(() => { setSearchInput(sp.get("q") ?? ""); }, [sp]);

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const accountId = sp.get("accountId") ?? "";
  const categoryId = sp.get("categoryId") ?? "";
  const direction = sp.get("direction") ?? "";
  const q = sp.get("q") ?? "";
  const sort = (sp.get("sort") === "amount" ? "amount" : "txnDate") as "txnDate" | "amount";
  const order = (sp.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";

  const hasActiveFilters = !!(from || to || accountId || categoryId || direction || q);

  // ── Date range helpers ─────────────────────────────────────────
  // All ISO "YYYY-MM-DD" strings, computed client-side in local TZ so the
  // pills line up with what the user sees in their statements.
  function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const today = new Date();
  const todayISO = toISO(today);
  function daysAgoISO(n: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return toISO(d);
  }
  const monthStartISO = toISO(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastMonthStart = toISO(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const lastMonthEnd = toISO(new Date(today.getFullYear(), today.getMonth(), 0));

  type RangePreset = "today" | "7d" | "30d" | "month" | "lastMonth" | "custom" | null;
  const RANGE_PRESETS: Array<{ id: Exclude<RangePreset, null>; label: string; from: string; to: string }> = [
    { id: "today",     label: "Today",      from: todayISO,       to: todayISO },
    { id: "7d",        label: "7 days",     from: daysAgoISO(6),  to: todayISO },
    { id: "30d",       label: "30 days",    from: daysAgoISO(29), to: todayISO },
    { id: "month",     label: "This month", from: monthStartISO,  to: todayISO },
    { id: "lastMonth", label: "Last month", from: lastMonthStart, to: lastMonthEnd },
  ];
  // Derive the currently active preset from the URL state (if any match).
  const activePreset: RangePreset = (() => {
    if (!from && !to) return null;
    const match = RANGE_PRESETS.find((p) => p.from === from && p.to === to);
    return match ? match.id : "custom";
  })();
  const [showCustomRange, setShowCustomRange] = useState(activePreset === "custom");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (direction) params.set("direction", direction);
    if (q) params.set("q", q);
    params.set("sort", sort);
    params.set("order", order);
    params.set("page", String(page));
    params.set("pageSize", "20");
    const r = await fetch(`/api/bank-accounts/transactions?${params}`);
    if (!r.ok) { setLoading(false); return; }
    const data = await r.json() as { items: Row[]; total: number; totalDebit: number; totalCredit: number; transferCount?: number };
    setRows(data.items);
    setTotal(data.total);
    setTotalDebit(data.totalDebit);
    setTotalCredit(data.totalCredit);
    setTransferCount(data.transferCount ?? 0);
    setLoading(false);
  }, [from, to, accountId, categoryId, direction, q, sort, order, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function updateFilter(key: string, value: string) {
    updateFilters({ [key]: value });
  }

  /**
   * Update multiple filter keys in one URL navigation. Empty string removes
   * the key. Always resets page to 1 because new filters change total count.
   */
  function updateFilters(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    next.set("page", "1");
    setPage(1);
    router.replace(`?${next.toString()}`);
  }

  function applyRangePreset(preset: (typeof RANGE_PRESETS)[number]) {
    setShowCustomRange(false);
    updateFilters({ from: preset.from, to: preset.to });
  }

  function toggleCustomRange() {
    setShowCustomRange((v) => !v);
  }

  function clearAllFilters() {
    setPage(1);
    setShowCustomRange(false);
    const next = new URLSearchParams();
    // Preserve sort preference across Clear-all — it's not a "filter".
    if (sort !== "txnDate") next.set("sort", sort);
    if (order !== "desc") next.set("order", order);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?");
  }

  /**
   * Click a sortable header: toggle order if same field, else switch field
   * with sensible default (date→desc / newest first, amount→desc / largest first).
   */
  function toggleSort(field: "txnDate" | "amount") {
    const next = new URLSearchParams(sp);
    if (sort === field) {
      next.set("order", order === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("order", "desc");
    }
    router.replace(`?${next.toString()}`);
  }

  async function updateCategory(id: string, newCategoryId: string) {
    const r = await fetch(`/api/bank-accounts/transactions/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: newCategoryId || null }),
    });
    if (!r.ok) return;
    const row = rows.find((x) => x.id === id);
    if (row && newCategoryId) {
      const pattern = window.prompt(
        "Create a merchant rule?",
        row.description.replace(/\d{6,}/g, "").trim().toUpperCase(),
      );
      if (pattern) {
        const also = confirm("Also re-categorize past transactions matching this pattern?");
        await fetch("/api/bank-accounts/transactions/categorize", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            transactionIds: [id],
            categoryId: newCategoryId,
            createRule: { pattern },
            recategorizePast: also,
          }),
        });
      }
    }
    fetchRows();
  }

  const pageSize = 20;
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div
        className="rounded-2xl border border-[var(--border)]"
        style={{ background: "var(--background)" }}
      >
        {/* Search — borderless command-bar style */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <Search size={15} className="text-[var(--text-tertiary)] shrink-0 pointer-events-none" />
          <input
            className="flex-1 bg-transparent text-[14px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none min-w-0"
            placeholder="Search transactions by description…"
            value={searchInput}
            onChange={(e) => {
              const v = e.target.value;
              setSearchInput(v);
              if (v.length === 0 || v.length >= 3) updateFilter("q", v);
            }}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); updateFilter("q", ""); }}
              className="p-1 rounded-full hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {/* Date range pills */}
            <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[var(--surface-deep)] border border-[var(--border)] shrink-0">
              <Calendar size={13} className="ml-2 mr-0.5 text-[var(--text-secondary)] shrink-0" />
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyRangePreset(p)}
                  className={
                    activePreset === p.id
                      ? "px-3 py-1.5 rounded-full text-[13px] font-bold bg-[rgba(255,56,92,0.18)] text-[var(--primary)] border border-[rgba(255,56,92,0.4)] transition-all"
                      : "px-3 py-1.5 rounded-full text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-all"
                  }
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={toggleCustomRange}
                className={
                  activePreset === "custom" || showCustomRange
                    ? "px-3 py-1.5 rounded-full text-[13px] font-bold bg-[rgba(255,56,92,0.18)] text-[var(--primary)] border border-[rgba(255,56,92,0.4)] transition-all"
                    : "px-3 py-1.5 rounded-full text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-all"
                }
              >
                Custom
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-[var(--border)] shrink-0" />

            {/* Facet pills */}
            <FacetSelect
              icon={<SlidersHorizontal size={12} />}
              label="Account"
              value={accountId}
              onChange={(v) => updateFilter("accountId", v)}
              options={accounts.map((a) => ({ value: a.id, label: a.label }))}
            />
            <FacetSelect
              label="Category"
              value={categoryId}
              onChange={(v) => updateFilter("categoryId", v)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <FacetSelect
              label="Direction"
              value={direction}
              onChange={(v) => updateFilter("direction", v)}
              options={[
                { value: "debit", label: "Debit" },
                { value: "credit", label: "Credit" },
              ]}
              allLabel="Both"
            />
          </div>
        </div>

        {/* Custom date pickers */}
        {(showCustomRange || activePreset === "custom") && (
          <div className="px-5 pb-4 border-t border-[var(--border)] pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-full sm:max-w-md">
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold block mb-1">From</label>
                <DatePicker value={from} onChange={(v) => updateFilter("from", v)} placeholder="Start date" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold block mb-1">To</label>
                <DatePicker value={to} onChange={(v) => updateFilter("to", v)} placeholder="End date" />
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips + totals */}
        {hasActiveFilters && (
          <div className="px-5 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {from && <ActiveChip label={`From ${formatDate(from)}`} onRemove={() => updateFilter("from", "")} />}
              {to && <ActiveChip label={`To ${formatDate(to)}`} onRemove={() => updateFilter("to", "")} />}
              {accountId && (
                <ActiveChip
                  label={accounts.find((a) => a.id === accountId)?.label ?? accountId}
                  icon="account"
                  onRemove={() => updateFilter("accountId", "")}
                />
              )}
              {categoryId && (
                <ActiveChip
                  label={categories.find((c) => c.id === categoryId)?.name ?? categoryId}
                  icon="category"
                  onRemove={() => updateFilter("categoryId", "")}
                />
              )}
              {direction && (
                <ActiveChip
                  label={direction === "debit" ? "Debits only" : "Credits only"}
                  icon={direction as "debit" | "credit"}
                  onRemove={() => updateFilter("direction", "")}
                />
              )}
              {q && <ActiveChip label={`"${q}"`} icon="search" onRemove={() => updateFilter("q", "")} />}
              <button
                onClick={clearAllFilters}
                className="ml-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-[var(--surface-muted)] transition-colors"
              >
                <X size={11} /> Clear all
              </button>
            </div>

            {!loading && total > 0 && (
              <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-[12px] bg-[var(--surface-deep)] border border-[var(--border)] rounded-xl px-4 py-2.5">
                <span className="text-[var(--text-tertiary)]">
                  <span className="text-[var(--text-primary)] font-bold">{total}</span> transaction{total === 1 ? "" : "s"}
                </span>
                {totalDebit > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowUpRight size={11} className="text-[var(--accent-error)]" />
                    <span className="text-[var(--accent-error)] font-bold mono">{formatINR(totalDebit)}</span>
                    <span className="text-[var(--text-tertiary)]">spent</span>
                  </span>
                )}
                {totalCredit > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft size={11} className="text-[var(--accent-success)]" />
                    <span className="text-[var(--accent-success)] font-bold mono">{formatINR(totalCredit)}</span>
                    <span className="text-[var(--text-tertiary)]">received</span>
                  </span>
                )}
                {totalDebit > 0 && totalCredit > 0 && (
                  <span className="text-[var(--text-tertiary)]">
                    net{" "}
                    <span className={`font-bold mono ${totalCredit >= totalDebit ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}`}>
                      {totalCredit >= totalDebit ? "+" : "-"}{formatINR(Math.abs(totalCredit - totalDebit))}
                    </span>
                  </span>
                )}
                {transferCount > 0 && (
                  <span className="text-[var(--text-tertiary)]" title="Transfers between your own accounts don't count as income or spending.">
                    · excl. {transferCount} transfer{transferCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table — desktop / tablet (md and up) */}
      <div className="ab-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface-muted)] sticky top-0 z-10">
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                  <SortHeader
                    label="Date"
                    field="txnDate"
                    currentSort={sort}
                    currentOrder={order}
                    onToggle={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Description</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">Account</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] hidden md:table-cell">Category</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right text-[var(--accent-error)]">
                  Debit
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right text-[var(--accent-success)]">
                  Credit
                </th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right" title="Cumulative running total across visible rows (chronological)">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-[var(--text-secondary)]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">No transactions match your filters</p>
                  {hasActiveFilters && (
                    <button onClick={clearAllFilters} className="text-[12px] text-[var(--primary)] mt-2 underline">Clear filters</button>
                  )}
                </td></tr>
              ) : rows.map((r) => {
                // Use AI-generated prettyDescription when available (non-Axis banks);
                // fall back to regex-based prettifyDescription for Axis/JS-parsed txns.
                const pretty = prettifyDescription(r.description);
                // Real running balance comes from the API (single-account view only);
                // null when the user is viewing all accounts.
                const rowBalance = r.balanceAfter;
                const displayLabel = r.prettyDescription ?? pretty.merchant;
                const isCredit = r.direction === "credit";
                const isEditingCategory = editingCategoryId === r.id;
                const catName = r.category?.name ?? null;
                return (
                <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]/60 transition-colors group">
                  <td className="px-3 py-2.5 mono text-[13px] font-medium text-[var(--text-primary)] whitespace-nowrap align-middle">
                    {formatDate(r.txnDate)}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px] sm:max-w-[280px] md:max-w-[380px] align-middle" title={r.description}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {pretty.transferDir && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                          {pretty.transferDir === "to" ? "To" : "From"}
                        </span>
                      )}
                      <span className="text-[var(--text-primary)] font-medium truncate">{displayLabel}</span>
                      {pretty.method && (
                        <span className={`ab-chip ${methodChipClass(pretty.method)}`} style={{ fontSize: 10, padding: "1px 7px", lineHeight: 1.5 }}>
                          {pretty.method}
                        </span>
                      )}
                      {pretty.counterBank && !r.prettyDescription && (
                        <span className="text-[11px] text-[var(--text-tertiary)]">· {pretty.counterBank}</span>
                      )}
                      {r.fd && (
                        <Link
                          href={`/dashboard/fd/${r.fd.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[var(--primary-tint)] text-[var(--primary)] border-[var(--chip-error-border)] hover:bg-[var(--chip-error-border)] transition-colors"
                          title={`Linked to FD at ${r.fd.bankName}`}
                        >
                          <Link2 size={10} />
                          FD · {r.fd.bankName.split(" ")[0]}
                          {r.fd.fdNumber ? ` · ${r.fd.fdNumber}` : r.fd.accountNumber ? ` · ${r.fd.accountNumber.slice(-4)}` : ""}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-[var(--text-secondary)] whitespace-nowrap align-middle hidden sm:table-cell">
                    {r.account.label}
                  </td>
                  <td className="px-3 py-2.5 align-middle hidden md:table-cell">
                    {isEditingCategory ? (
                      <select
                        autoFocus
                        className="ab-input py-1 text-[12px] min-w-[140px]"
                        style={{ padding: "4px 8px" }}
                        value={r.categoryId ?? ""}
                        onChange={(e) => {
                          updateCategory(r.id, e.target.value);
                          setEditingCategoryId(null);
                        }}
                        onBlur={() => setEditingCategoryId(null)}
                      >
                        <option value="">— none —</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(r.id)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-left px-2 py-1 rounded-md hover:bg-[var(--surface-muted)] transition-colors"
                        title="Click to change category"
                      >
                        {catName ? (
                          <span className="text-[var(--text-primary)]">{catName}</span>
                        ) : (
                          <span className="text-[var(--text-tertiary)] italic">Uncategorized</span>
                        )}
                        <Pencil
                          size={11}
                          className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    )}
                  </td>
                  {/* Debit */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle mono">
                    {!isCredit ? (
                      <span className="text-[var(--accent-error)] font-semibold">
                        {formatINR(r.amount)}
                      </span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  {/* Credit */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle mono">
                    {isCredit ? (
                      <span className="text-[var(--accent-success)] font-semibold">
                        {formatINR(r.amount)}
                      </span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  {/* Balance */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle mono">
                    {rowBalance != null ? (
                      <span className={`font-semibold ${rowBalance >= 0 ? "text-[var(--text-primary)]" : "text-[var(--accent-error)]"}`}>
                        {rowBalance >= 0 ? "" : "-"}{formatINR(Math.abs(rowBalance))}
                      </span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]" title="No running balance recorded for this transaction">—</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card list — phones / small tablets (below md) */}
      <div className="md:hidden space-y-2">
        {loading && rows.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 animate-pulse"
            >
              <div className="h-4 w-1/2 rounded bg-[var(--surface-muted)]" />
              <div className="mt-2.5 h-3 w-1/3 rounded bg-[var(--surface-muted)]" />
              <div className="mt-3 h-6 w-24 rounded-full bg-[var(--surface-muted)]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">No transactions match your filters</p>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-[12px] text-[var(--primary)] mt-2 underline">Clear filters</button>
            )}
          </div>
        ) : (
          rows.map((r) => (
            <TransactionCard
              key={r.id}
              r={r}
              categories={categories}
              isEditing={editingCategoryId === r.id}
              onEdit={() => setEditingCategoryId(r.id)}
              onCancelEdit={() => setEditingCategoryId(null)}
              onCategoryChange={(newId) => {
                updateCategory(r.id, newId);
                setEditingCategoryId(null);
              }}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
        <span>
          {total > 0 ? (
            <>Showing <span className="text-[var(--text-primary)] font-semibold">{showingFrom}–{showingTo}</span> of <span className="text-[var(--text-primary)] font-semibold">{total}</span></>
          ) : (
            "0 results"
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="ab-btn ab-btn-ghost px-3 py-2.5 min-h-[40px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="px-3 text-[var(--text-primary)] font-semibold">Page {page}</span>
          <button
            className="ab-btn ab-btn-ghost px-3 py-2.5 min-h-[40px]"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────

/**
 * Mobile presentation of a single transaction. Renders the same fields as a
 * table row (date, description, account, category, amount, balance, FD link)
 * stacked into a card, since the table's Account/Category columns are hidden
 * below md and horizontal scrolling is awkward on touch. Category stays
 * tap-to-edit, mirroring the desktop pencil-edit flow.
 */
function TransactionCard({
  r,
  categories,
  isEditing,
  onEdit,
  onCancelEdit,
  onCategoryChange,
}: {
  r: Row;
  categories: { id: string; name: string }[];
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onCategoryChange: (newCategoryId: string) => void;
}) {
  const pretty = prettifyDescription(r.description);
  const rowBalance = r.balanceAfter;
  const displayLabel = r.prettyDescription ?? pretty.merchant;
  const isCredit = r.direction === "credit";
  const catName = r.category?.name ?? null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
      {/* Merchant + amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
          {pretty.transferDir && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {pretty.transferDir === "to" ? "To" : "From"}
            </span>
          )}
          <span className="text-[14px] font-semibold text-[var(--text-primary)] break-words">{displayLabel}</span>
          {pretty.method && (
            <span className={`ab-chip ${methodChipClass(pretty.method)}`} style={{ fontSize: 10, padding: "1px 7px", lineHeight: 1.5 }}>
              {pretty.method}
            </span>
          )}
        </div>
        <span
          className={`mono text-[15px] font-bold whitespace-nowrap ${isCredit ? "text-[var(--accent-success)]" : "text-[var(--accent-error)]"}`}
        >
          {isCredit ? "+" : "−"}{formatINR(r.amount)}
        </span>
      </div>

      {/* FD link */}
      {r.fd && (
        <div className="mt-1.5">
          <Link
            href={`/dashboard/fd/${r.fd.id}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[var(--primary-tint)] text-[var(--primary)] border-[var(--chip-error-border)] hover:bg-[var(--chip-error-border)] transition-colors"
            title={`Linked to FD at ${r.fd.bankName}`}
          >
            <Link2 size={10} />
            FD · {r.fd.bankName.split(" ")[0]}
            {r.fd.fdNumber ? ` · ${r.fd.fdNumber}` : r.fd.accountNumber ? ` · ${r.fd.accountNumber.slice(-4)}` : ""}
          </Link>
        </div>
      )}

      {/* Date · account */}
      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] min-w-0">
        <span className="mono whitespace-nowrap">{formatDate(r.txnDate)}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span className="truncate">{r.account.label}</span>
      </div>

      {/* Category + running balance */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {isEditing ? (
          <select
            autoFocus
            className="ab-input py-1 text-[12px] min-w-[140px]"
            style={{ padding: "4px 8px" }}
            value={r.categoryId ?? ""}
            onChange={(e) => onCategoryChange(e.target.value)}
            onBlur={onCancelEdit}
          >
            <option value="">— none —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-deep)] hover:bg-[var(--surface-muted)] transition-colors"
            title="Tap to change category"
          >
            {catName ? (
              <span className="text-[var(--text-primary)] font-medium">{catName}</span>
            ) : (
              <span className="text-[var(--text-tertiary)] italic">Uncategorized</span>
            )}
            <Pencil size={11} className="text-[var(--text-tertiary)]" />
          </button>
        )}
        {rowBalance != null && (
          <span className="text-[12px] mono text-[var(--text-secondary)] whitespace-nowrap">
            Bal{" "}
            <span className={`font-semibold ${rowBalance >= 0 ? "text-[var(--text-primary)]" : "text-[var(--accent-error)]"}`}>
              {rowBalance >= 0 ? "" : "-"}{formatINR(Math.abs(rowBalance))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Pill-styled facet filter — native select under the hood for zero-extra-work
 * keyboard + a11y, but restyled to blend with the rounded chip row above.
 * The chevron is faked via background-image on the select.
 */
function FacetSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  icon?: React.ReactNode;
}) {
  const active = !!value;
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <div className="relative">
      <div
        className={
          active
            ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold bg-[rgba(255,56,92,0.18)] text-[var(--primary)] border border-[rgba(255,56,92,0.4)] transition-colors"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold text-[var(--text-primary)] bg-[var(--surface-raised)] border border-[var(--border-strong)] hover:border-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] transition-colors"
        }
      >
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">{label}:</span>
        <span>{selectedLabel}</span>
        <ChevronRight size={11} className="rotate-90 opacity-70 -mr-0.5" />
      </div>
      {/* Native <select> stacked on top, invisible but clickable. */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label={label}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Small dismissible chip used in the "Active filters" row. */
function ActiveChip({
  label,
  onRemove,
  icon,
}: {
  label: string;
  onRemove: () => void;
  icon?: "account" | "category" | "search" | "debit" | "credit";
}) {
  // Colour by semantic meaning: debit = red, credit = green, rest = accent
  const isDebit = icon === "debit";
  const isCredit = icon === "credit";
  const bg   = isDebit  ? "bg-[rgba(255,122,110,0.12)] border-[rgba(255,122,110,0.3)] text-[var(--accent-error)]"
             : isCredit ? "bg-[rgba(94,224,164,0.12)] border-[rgba(94,224,164,0.3)] text-[var(--accent-success)]"
             :            "bg-[rgba(255,56,92,0.1)] border-[rgba(255,56,92,0.25)] text-[var(--accent-error)]";
  const hover = isDebit  ? "hover:bg-[rgba(255,122,110,0.22)]"
              : isCredit ? "hover:bg-[rgba(94,224,164,0.22)]"
              :            "hover:bg-[rgba(255,56,92,0.2)]";
  return (
    <span className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-semibold border transition-colors ${bg}`}>
      {label}
      <button
        onClick={onRemove}
        className={`p-0.5 rounded-full transition-colors ${hover}`}
        aria-label={`Remove ${label} filter`}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/**
 * Clickable column-header with sort-direction indicator.
 * Inactive headers show a muted up/down icon hinting they're sortable.
 */
function SortHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onToggle,
  align = "left",
}: {
  label: string;
  field: "txnDate" | "amount";
  currentSort: "txnDate" | "amount";
  currentOrder: "asc" | "desc";
  onToggle: (f: "txnDate" | "amount") => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort === field;
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={
        "inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors " +
        (isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]") +
        (align === "right" ? " ml-auto" : "")
      }
      title={`Sort by ${label}`}
    >
      {align === "right" && isActive && (
        currentOrder === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
      )}
      <span>{label}</span>
      {align !== "right" && (
        isActive
          ? (currentOrder === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
          : <ArrowUpDown size={11} className="opacity-50" />
      )}
      {align === "right" && !isActive && <ArrowUpDown size={11} className="opacity-50" />}
    </button>
  );
}
