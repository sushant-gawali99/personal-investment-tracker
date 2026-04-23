"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Download, FileDown, Search, IndianRupee, Building2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Tag, Check } from "lucide-react";
import type { VoucherType, ExportFilters, CategoryForExport } from "@/lib/bank-accounts/tally-types";

interface MappingRow extends CategoryForExport {
  tallyLedgerName: string;
  voucherType: VoucherType;
}

const UNCATEGORIZED_ROW: CategoryForExport = {
  categoryId: "__uncategorized__",
  categoryName: "Uncategorized",
  kind: "—",
};

const KIND_LABELS: Record<string, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  "—": "—",
};

const VOUCHER_TYPES: VoucherType[] = ["Payment", "Receipt", "Contra", "Journal"];

const KIND_COLORS: Record<string, string> = {
  expense: "text-[#ff7a6e]",
  income: "text-[#5ee0a4]",
  transfer: "text-[#5aa9ff]",
  "—": "text-[#6e6e73]",
};

export function TallyExportClient({
  accounts,
  categories,
}: {
  accounts: { id: string; label: string }[];
  categories: { id: string; name: string; kind: string }[];
}) {
  const [step, setStep] = useState<"filters" | "ledger-mapping">("filters");
  const [filters, setFilters] = useState<ExportFilters>({
    from: "",
    to: "",
    accountId: "",
    categoryIds: [],
    direction: "",
    q: "",
    minAmount: "",
    maxAmount: "",
  });
  const [txnCount, setTxnCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [bankLedgerName, setBankLedgerName] = useState("");
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setCountLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.accountId) params.set("accountId", filters.accountId);
    (filters.categoryIds ?? []).forEach((id) => params.append("categoryId", id));
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.q) params.set("q", filters.q);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
    params.set("pageSize", "1");

    try {
      const r = await fetch(`/api/bank-accounts/transactions?${params}`);
      if (r.ok) {
        const data = await r.json() as { total: number };
        setTxnCount(data.total);
      }
    } finally {
      setCountLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 400);
    return () => clearTimeout(t);
  }, [fetchCount]);

  async function handleNext() {
    if (!txnCount) return;
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.accountId) params.set("accountId", filters.accountId);
    (filters.categoryIds ?? []).forEach((id) => params.append("categoryId", id));
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.q) params.set("q", filters.q);
    if (filters.minAmount) params.set("minAmount", filters.minAmount);
    if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);

    const r = await fetch(`/api/bank-accounts/export/tally/categories?${params}`);
    if (!r.ok) { setError("Failed to load categories"); return; }
    const data = await r.json() as { categories: CategoryForExport[]; hasUncategorized: boolean };

    const rows: MappingRow[] = [
      ...data.categories.map((c) => ({ ...c, tallyLedgerName: "", voucherType: "Payment" as VoucherType })),
      ...(data.hasUncategorized ? [{ ...UNCATEGORIZED_ROW, tallyLedgerName: "", voucherType: "Payment" as VoucherType }] : []),
    ];
    setMappings(rows);
    const selectedAccount = accounts.find((a) => a.id === filters.accountId);
    setBankLedgerName(selectedAccount?.label ?? "Multiple Accounts");
    setError(null);
    setStep("ledger-mapping");
  }

  function handleBack() {
    if (mappings.some((m) => m.tallyLedgerName)) {
      if (!confirm("Going back will reset your ledger mapping. Continue?")) return;
    }
    setMappings([]);
    setStep("filters");
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const ledgerConfig = {
        bankLedgerName,
        categoryMappings: mappings.map((m) => ({
          categoryId: m.categoryId === "__uncategorized__" ? null : m.categoryId,
          tallyLedgerName: m.tallyLedgerName,
          voucherType: m.voucherType,
        })),
      };
      const r = await fetch("/api/bank-accounts/export/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, ledgerConfig }),
      });
      if (!r.ok) {
        const err = await r.json() as { error: string };
        setError(err.error ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tally-export-${new Date().toISOString().split("T")[0]}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const downloadDisabled =
    !bankLedgerName.trim() || mappings.some((m) => !m.tallyLedgerName.trim()) || downloading;

  function toggleCategory(id: string) {
    setFilters((f) => {
      const current = f.categoryIds ?? [];
      return {
        ...f,
        categoryIds: current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
      };
    });
  }

  const inputClass =
    "w-full h-10 px-3 rounded-xl bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#3a3a3f] focus:outline-none focus:border-[#ff385c]/40 focus:bg-[#111113] transition-colors";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-colors ${step === "filters" ? "bg-[#ff385c] text-white" : "bg-[#5ee0a4] text-[#0e0e11]"}`}>
              {step === "filters" ? "1" : <Check size={10} strokeWidth={3} />}
            </div>
            <span className={`text-[12px] font-medium transition-colors ${step === "filters" ? "text-[#ededed]" : "text-[#5ee0a4]"}`}>Select</span>
          </div>
          <div className={`h-px flex-1 max-w-[40px] transition-colors ${step === "ledger-mapping" ? "bg-[#5ee0a4]/40" : "bg-[#2a2a2e]"}`} />
          <div className="flex items-center gap-1.5">
            <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-colors ${step === "ledger-mapping" ? "bg-[#ff385c] text-white" : "bg-[#2a2a2e] text-[#6e6e73]"}`}>2</div>
            <span className={`text-[12px] font-medium transition-colors ${step === "ledger-mapping" ? "text-[#ededed]" : "text-[#6e6e73]"}`}>Map Ledgers</span>
          </div>
        </div>
        <h1 className="text-[26px] font-bold text-[#ededed] tracking-tight">
          {step === "filters" ? "Select transactions" : "Map to Tally ledgers"}
        </h1>
        <p className="text-[13px] text-[#6e6e73] mt-1">
          {step === "filters"
            ? "Choose which transactions to include in the Tally export."
            : "Assign a Tally ledger name and voucher type to each category."}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#ff7a6e]/8 border border-[#ff7a6e]/20 text-[13px] text-[#ff7a6e]">
          {error}
        </div>
      )}

      {/* ── STEP 1: Filters ── */}
      {step === "filters" && (
        <div className="space-y-4">

          {/* Account & Direction */}
          <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Building2 size={13} className="text-[#6e6e73]" />
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Account</span>
            </div>

            <select
              value={filters.accountId}
              onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
              className={inputClass}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>

            {/* Direction segmented control */}
            <div>
              <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider mb-2">Direction</p>
              <div className="flex gap-2">
                {[
                  { value: "", label: "All", icon: <ArrowLeftRight size={12} /> },
                  { value: "debit", label: "Debit", icon: <ArrowDownLeft size={12} /> },
                  { value: "credit", label: "Credit", icon: <ArrowUpRight size={12} /> },
                ].map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, direction: value }))}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12px] font-medium border transition-all ${
                      filters.direction === value
                        ? "bg-[#ff385c]/10 border-[#ff385c]/40 text-[#ff385c]"
                        : "bg-[#111113] border-[#2a2a2e] text-[#6e6e73] hover:border-[#3a3a3f] hover:text-[#a0a0a5]"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Date range</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6e6e73]">From</label>
                <DatePicker
                  value={filters.from ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6e6e73]">To</label>
                <DatePicker
                  value={filters.to ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
                  placeholder="End date"
                />
              </div>
            </div>
          </div>

          {/* Amount & Search */}
          <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <IndianRupee size={13} className="text-[#6e6e73]" />
              <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Filters</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6e6e73]">Min amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3f] text-[12px]">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={filters.minAmount}
                    onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
                    placeholder="0"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-[#6e6e73]">Max amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3f] text-[12px]">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
                    placeholder="No limit"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#6e6e73]">Description</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3a3a3f]" />
                <input
                  type="text"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Search transactions…"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-[#6e6e73]" />
                  <span className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Categories</span>
                </div>
                {(filters.categoryIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, categoryIds: [] }))}
                    className="text-[11px] text-[#6e6e73] hover:text-[#a0a0a5] transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const active = (filters.categoryIds ?? []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-all ${
                        active
                          ? "bg-[#ff385c]/10 border-[#ff385c]/40 text-[#ff385c]"
                          : "bg-[#111113] border-[#2a2a2e] text-[#a0a0a5] hover:border-[#3a3a3f] hover:text-[#ededed]"
                      }`}
                    >
                      {active && <Check size={10} strokeWidth={3} />}
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 h-9">
              {countLoading ? (
                <span className="text-[13px] text-[#6e6e73]">Counting…</span>
              ) : txnCount === null ? null : txnCount === 0 ? (
                <span className="text-[13px] text-[#6e6e73]">No transactions match</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#5ee0a4]/10 border border-[#5ee0a4]/20 text-[12px] font-semibold text-[#5ee0a4]">
                  {txnCount.toLocaleString()} transaction{txnCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={!txnCount}
              className="ab-btn ab-btn-accent"
            >
              <FileDown size={14} />
              Next: Map Ledgers
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Ledger Mapping ── */}
      {step === "ledger-mapping" && (
        <div className="space-y-4">
          <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Bank ledger in Tally</label>
              <input
                type="text"
                value={bankLedgerName}
                onChange={(e) => setBankLedgerName(e.target.value)}
                placeholder="e.g. HDFC Bank A/c"
                className={`${inputClass} mt-2`}
              />
            </div>
          </div>

          <div className="p-4 bg-[#17171a] border border-[#2a2a2e] rounded-2xl space-y-3">
            <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">Category mapping</p>
            <div className="space-y-2">
              {mappings.map((row, i) => (
                <div key={row.categoryId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-3 bg-[#111113] rounded-xl border border-[#2a2a2e]">
                  <div>
                    <p className="text-[13px] font-medium text-[#ededed] leading-tight">{row.categoryName}</p>
                    <p className={`text-[11px] mt-0.5 ${KIND_COLORS[row.kind] ?? "text-[#6e6e73]"}`}>
                      {KIND_LABELS[row.kind] ?? row.kind}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={row.tallyLedgerName}
                    onChange={(e) =>
                      setMappings((ms) =>
                        ms.map((m, j) => j === i ? { ...m, tallyLedgerName: e.target.value } : m)
                      )
                    }
                    placeholder="Ledger name"
                    className="h-9 w-44 px-3 rounded-xl bg-[#17171a] border border-[#2a2a2e] text-[12px] text-[#ededed] placeholder-[#3a3a3f] focus:outline-none focus:border-[#ff385c]/40 transition-colors"
                  />
                  <select
                    value={row.voucherType}
                    onChange={(e) =>
                      setMappings((ms) =>
                        ms.map((m, j) => j === i ? { ...m, voucherType: e.target.value as VoucherType } : m)
                      )
                    }
                    className="h-9 px-2 rounded-xl bg-[#17171a] border border-[#2a2a2e] text-[12px] text-[#ededed] focus:outline-none focus:border-[#ff385c]/40 transition-colors"
                  >
                    {VOUCHER_TYPES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button onClick={handleBack} className="ab-btn ab-btn-secondary">
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-3">
              {txnCount !== null && (
                <span className="text-[12px] text-[#6e6e73]">
                  {txnCount.toLocaleString()} transaction{txnCount === 1 ? "" : "s"}
                </span>
              )}
              <button
                onClick={handleDownload}
                disabled={downloadDisabled}
                className="ab-btn ab-btn-accent"
              >
                <Download size={14} />
                {downloading ? "Generating…" : "Download XML"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
