"use client";
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
  amount: number;
  direction: "debit" | "credit";
  categoryId: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; label: string };
  notes: string | null;
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
  const [page, setPage] = useState(Number(sp.get("page") ?? "1"));
  const [loading, setLoading] = useState(true);
  // Which row's category is in edit mode. Default: none — categories are
  // read-only until the user explicitly clicks the pencil to avoid
  // accidental re-categorisation of large lists.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

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
    const data = await r.json() as { items: Row[]; total: number; totalDebit: number; totalCredit: number };
    setRows(data.items);
    setTotal(data.total);
    setTotalDebit(data.totalDebit);
    setTotalCredit(data.totalCredit);
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
      {/* Filter bar — three layers:
          1. Prominent search that always stays in place.
          2. Quick-range pills + dropdown-pill facets for one-tap filtering.
          3. Inline custom date pickers (only when Custom is toggled or dates set manually).
          4. Active-filter chips row, each with its own remove-X.
       */}
      <div className="ab-card p-5 space-y-4">
        {/* Layer 1: Search (full-width, prominent).
            NOTE: `.ab-input` declares `padding: 12px 14px` (shorthand) in
            globals.css, which can beat Tailwind's `pl-11`/`pr-10` utilities
            depending on stylesheet order. Force paddings via inline style
            so the search icon and clear button never overlap the text. */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6e6e73] pointer-events-none z-10" />
          <input
            className="ab-input text-[14px]"
            style={{ paddingLeft: 44, paddingRight: 40 }}
            placeholder="Search transactions by description…"
            value={q}
            onChange={(e) => updateFilter("q", e.target.value)}
          />
          {q && (
            <button
              onClick={() => updateFilter("q", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#2a2a2e] text-[#a0a0a5] hover:text-[#ededed] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Layer 2: Quick-range pills + facet pills */}
        <div className="overflow-x-auto pb-0.5 -mb-0.5">
        <div className="flex items-center gap-2 min-w-max">
          {/* Date range pills */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#1c1c20] border border-[#2a2a2e] shrink-0">
            <Calendar size={13} className="ml-2 mr-1 text-[#6e6e73]" />
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyRangePreset(p)}
                className={
                  activePreset === p.id
                    ? "px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#ededed] text-[#0e0e11] transition-colors"
                    : "px-3 py-1.5 rounded-full text-[12px] font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#2a2a2e] transition-colors"
                }
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={toggleCustomRange}
              className={
                activePreset === "custom" || showCustomRange
                  ? "px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#ededed] text-[#0e0e11] transition-colors"
                  : "px-3 py-1.5 rounded-full text-[12px] font-medium text-[#a0a0a5] hover:text-[#ededed] hover:bg-[#2a2a2e] transition-colors"
              }
            >
              Custom
            </button>
          </div>

          {/* Facet pills (native selects styled like pills) */}
          <div className="inline-flex items-center gap-1.5 shrink-0">
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

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="ml-auto text-[12px] text-[#a0a0a5] hover:text-[#ededed] flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-[#1c1c20] transition-colors"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        </div>

        {/* Layer 3: Inline custom date pickers */}
        {(showCustomRange || activePreset === "custom") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-full sm:max-w-md pt-1">
            <div>
              <label className="text-[10px] text-[#6e6e73] uppercase tracking-wider font-semibold block mb-1">From</label>
              <DatePicker value={from} onChange={(v) => updateFilter("from", v)} placeholder="Start date" />
            </div>
            <div>
              <label className="text-[10px] text-[#6e6e73] uppercase tracking-wider font-semibold block mb-1">To</label>
              <DatePicker value={to} onChange={(v) => updateFilter("to", v)} placeholder="End date" />
            </div>
          </div>
        )}

        {/* Layer 4: Active filter chips + totals summary */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-[#2a2a2e] space-y-3">
            {/* Chips row */}
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
            </div>

            {/* Totals summary — only shown once data has loaded */}
            {!loading && total > 0 && (
              <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[12px] bg-[#1c1c20] rounded-lg px-3 py-2">
                <span className="text-[#a0a0a5]">
                  <span className="text-[#ededed] font-semibold">{total}</span> transaction{total === 1 ? "" : "s"}
                </span>
                {totalDebit > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowUpRight size={11} className="text-[#ff7a6e]" />
                    <span className="text-[#ff7a6e] font-semibold mono">{formatINR(totalDebit)}</span>
                    <span className="text-[#6e6e73]">spent</span>
                  </span>
                )}
                {totalCredit > 0 && (
                  <span className="flex items-center gap-1">
                    <ArrowDownLeft size={11} className="text-[#5ee0a4]" />
                    <span className="text-[#5ee0a4] font-semibold mono">{formatINR(totalCredit)}</span>
                    <span className="text-[#6e6e73]">received</span>
                  </span>
                )}
                {totalDebit > 0 && totalCredit > 0 && (
                  <span className="text-[#6e6e73]">
                    net{" "}
                    <span className={`font-semibold mono ${totalCredit >= totalDebit ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}>
                      {totalCredit >= totalDebit ? "+" : "-"}{formatINR(Math.abs(totalCredit - totalDebit))}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="ab-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#1c1c20] sticky top-0 z-10">
              <tr className="text-left text-[#a0a0a5] border-b border-[#2a2a2e]">
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
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-right">
                  <SortHeader
                    label="Amount"
                    field="amount"
                    currentSort={sort}
                    currentOrder={order}
                    onToggle={toggleSort}
                    align="right"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-[#a0a0a5]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center">
                  <p className="text-[14px] font-semibold text-[#ededed]">No transactions match your filters</p>
                  {hasActiveFilters && (
                    <button onClick={clearAllFilters} className="text-[12px] text-[#ff385c] mt-2 underline">Clear filters</button>
                  )}
                </td></tr>
              ) : rows.map((r) => {
                const pretty = prettifyDescription(r.description);
                const isCredit = r.direction === "credit";
                const isEditingCategory = editingCategoryId === r.id;
                const catName = r.category?.name ?? null;
                return (
                <tr key={r.id} className="border-t border-[#2a2a2e] hover:bg-[#1c1c20]/60 transition-colors group">
                  <td className="px-3 py-2.5 mono text-[12px] text-[#a0a0a5] whitespace-nowrap align-middle">
                    {formatDate(r.txnDate)}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px] sm:max-w-[280px] md:max-w-[380px] align-middle" title={r.description}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#ededed] font-medium truncate">{pretty.merchant}</span>
                      {pretty.method && (
                        <span className={`ab-chip ${methodChipClass(pretty.method)}`} style={{ fontSize: 10, padding: "1px 7px", lineHeight: 1.5 }}>
                          {pretty.method}
                        </span>
                      )}
                      {pretty.counterBank && (
                        <span className="text-[11px] text-[#6e6e73]">. {pretty.counterBank}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-[#a0a0a5] whitespace-nowrap align-middle hidden sm:table-cell">
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
                        className="inline-flex items-center gap-1.5 text-[12px] text-left px-2 py-1 rounded-md hover:bg-[#1c1c20] transition-colors"
                        title="Click to change category"
                      >
                        {catName ? (
                          <span className="text-[#ededed]">{catName}</span>
                        ) : (
                          <span className="text-[#6e6e73] italic">Uncategorized</span>
                        )}
                        <Pencil
                          size={11}
                          className="text-[#6e6e73] opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle">
                    <div
                      className={`inline-flex items-center gap-1 mono font-semibold ${isCredit ? "text-[#5ee0a4]" : "text-[#ff7a6e]"}`}
                    >
                      {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {isCredit ? "+" : "-"}{formatINR(r.amount)}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-[12px] text-[#a0a0a5]">
        <span>
          {total > 0 ? (
            <>Showing <span className="text-[#ededed] font-semibold">{showingFrom}–{showingTo}</span> of <span className="text-[#ededed] font-semibold">{total}</span></>
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
          <span className="px-3 text-[#ededed] font-semibold">Page {page}</span>
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
            ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[rgba(255,56,92,0.14)] text-[#ff385c] border border-[rgba(255,56,92,0.3)] transition-colors"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-[#a0a0a5] bg-[#1c1c20] border border-[#2a2a2e] hover:text-[#ededed] hover:border-[#3a3a3f] transition-colors"
        }
      >
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}:</span>
        <span>{selectedLabel}</span>
        <ChevronRight size={11} className="rotate-90 opacity-60 -mr-0.5" />
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
  const bg   = isDebit  ? "bg-[rgba(255,122,110,0.12)] border-[rgba(255,122,110,0.3)] text-[#ff7a6e]"
             : isCredit ? "bg-[rgba(94,224,164,0.12)] border-[rgba(94,224,164,0.3)] text-[#5ee0a4]"
             :            "bg-[rgba(255,56,92,0.1)] border-[rgba(255,56,92,0.25)] text-[#ff6b85]";
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
        "inline-flex items-center gap-1 hover:text-[#ededed] transition-colors " +
        (isActive ? "text-[#ededed]" : "text-[#a0a0a5]") +
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
