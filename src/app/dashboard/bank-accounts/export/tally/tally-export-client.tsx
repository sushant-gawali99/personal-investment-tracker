"use client";

import { useCallback, useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Download, FileDown } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Export to Tally</h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Generate a Tally ERP 9 XML file from your bank transactions.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {step === "filters" && (
        <div className="space-y-5">
          <div className="p-4 bg-[#1c1c20] border border-[#2a2a2e] rounded-xl space-y-4">
            <h2 className="text-[15px] font-semibold text-[#ededed]">Step 1 — Select transactions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Account</label>
                <select
                  value={filters.accountId}
                  onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                >
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                >
                  <option value="">All</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">From</label>
                <DatePicker
                  value={filters.from ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
                  placeholder="Start date"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">To</label>
                <DatePicker
                  value={filters.to ?? ""}
                  onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
                  placeholder="End date"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Min amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.minAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#a0a0a5]">Max amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
                  placeholder="No limit"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[12px] text-[#a0a0a5]">Description search</label>
                <input
                  type="text"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="e.g. SWIGGY"
                  className="w-full h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[12px] text-[#a0a0a5]">
                  Categories{" "}
                  <span className="text-[#6e6e73]">(hold Ctrl/Cmd to select multiple)</span>
                </label>
                <select
                  multiple
                  value={filters.categoryIds ?? []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFilters((f) => ({ ...f, categoryIds: selected }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                  size={Math.min(categories.length, 6)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {(filters.categoryIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, categoryIds: [] }))}
                    className="text-[11px] text-[#6e6e73] hover:text-[#a0a0a5]"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[13px] text-[#a0a0a5]">
              {countLoading
                ? "Counting…"
                : txnCount === null
                ? ""
                : txnCount === 0
                ? "No transactions match these filters"
                : `${txnCount.toLocaleString()} transaction${txnCount === 1 ? "" : "s"} matched`}
            </p>
            <button
              onClick={handleNext}
              disabled={!txnCount}
              className="ab-btn ab-btn-accent"
            >
              <FileDown size={15} /> Next: Configure Ledgers
            </button>
          </div>
        </div>
      )}

      {step === "ledger-mapping" && (
        <div className="space-y-5">
          <div className="p-4 bg-[#1c1c20] border border-[#2a2a2e] rounded-xl space-y-4">
            <h2 className="text-[15px] font-semibold text-[#ededed]">Step 2 — Map to Tally ledgers</h2>

            <div className="space-y-1">
              <label className="text-[12px] text-[#a0a0a5]">Bank ledger name in Tally</label>
              <input
                type="text"
                value={bankLedgerName}
                onChange={(e) => setBankLedgerName(e.target.value)}
                placeholder="e.g. HDFC Bank A/c"
                className="w-full sm:w-72 h-9 px-3 rounded-lg bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#2a2a2e]">
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium">Category</th>
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium">Kind</th>
                    <th className="text-left py-2 pr-4 text-[#6e6e73] font-medium w-56">Tally Ledger Name</th>
                    <th className="text-left py-2 text-[#6e6e73] font-medium">Voucher Type</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((row, i) => (
                    <tr key={row.categoryId} className="border-b border-[#1e1e22]">
                      <td className="py-2 pr-4 text-[#ededed]">{row.categoryName}</td>
                      <td className="py-2 pr-4 text-[#6e6e73]">{KIND_LABELS[row.kind] ?? row.kind}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={row.tallyLedgerName}
                          onChange={(e) =>
                            setMappings((ms) =>
                              ms.map((m, j) =>
                                j === i ? { ...m, tallyLedgerName: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Ledger name"
                          className="w-full h-8 px-2 rounded-md bg-[#111113] border border-[#2a2a2e] text-[#ededed] placeholder-[#6e6e73] focus:outline-none focus:border-[#3a3a3e]"
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={row.voucherType}
                          onChange={(e) =>
                            setMappings((ms) =>
                              ms.map((m, j) =>
                                j === i ? { ...m, voucherType: e.target.value as VoucherType } : m
                              )
                            )
                          }
                          className="h-8 px-2 rounded-md bg-[#111113] border border-[#2a2a2e] text-[13px] text-[#ededed] focus:outline-none focus:border-[#3a3a3e]"
                        >
                          {VOUCHER_TYPES.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleBack} className="ab-btn ab-btn-secondary">
              <ArrowLeft size={15} /> Back to Filters
            </button>
            <div className="flex items-center gap-3">
              <p className="text-[13px] text-[#a0a0a5]">
                {txnCount?.toLocaleString()} transaction{txnCount === 1 ? "" : "s"} will be exported
              </p>
              <button
                onClick={handleDownload}
                disabled={downloadDisabled}
                className="ab-btn ab-btn-accent"
              >
                <Download size={15} />
                {downloading ? "Generating…" : "Download XML"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
