// src/app/dashboard/bank-accounts/overview-client.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { MonthPicker } from "@/components/bank-accounts/month-picker";
import { StatCards } from "@/components/bank-accounts/stat-cards";
import { CategoryBreakdownChart } from "@/components/bank-accounts/category-breakdown-chart";
import { MonthTrendChart } from "@/components/bank-accounts/month-trend-chart";
import { TopMerchantsList } from "@/components/bank-accounts/top-merchants-list";
import { DailyHeatmap } from "@/components/bank-accounts/daily-heatmap";
import { IncomeExpenseChart } from "@/components/bank-accounts/income-expense-chart";

interface Summary {
  stats: { spending: number; income: number; net: number; count: number };
  monthTrend: { month: string; spending: number; income: number }[];
  heatmap: Record<string, number>;
  incomeExpense: { month: string; spending: number; income: number }[];
}

export function OverviewClient({ accounts }: { accounts: { id: string; label: string }[] }) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [accountId, setAccountId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<{ categoryId: string | null; name: string; total: number }[]>([]);
  const [merchants, setMerchants] = useState<{ normalizedDescription: string; total: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Pin each row of the analytics grid to the natural height of the chart
  // on the right, then scroll the list on the left internally. The trend
  // chart (row 1) and heatmap (row 2) both have bounded visual content,
  // while CategoryBreakdown and TopMerchants can have arbitrarily long lists.
  const trendRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [trendHeight, setTrendHeight] = useState<number | undefined>();
  const [heatmapHeight, setHeatmapHeight] = useState<number | undefined>();
  useEffect(() => {
    const observers: ResizeObserver[] = [];
    const pairs: Array<[HTMLDivElement | null, (h: number) => void]> = [
      [trendRef.current, setTrendHeight],
      [heatmapRef.current, setHeatmapHeight],
    ];
    for (const [el, setter] of pairs) {
      if (!el) continue;
      const measure = () => setter(el.offsetHeight);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      observers.push(ro);
    }
    return () => observers.forEach((ro) => ro.disconnect());
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (accountId) qs.set("accountId", accountId);
    const [s, c, m] = await Promise.all([
      fetch(`/api/bank-accounts/analytics/summary?${qs}`).then((r) => r.json()),
      fetch(`/api/bank-accounts/analytics/categories?${qs}&direction=debit`).then((r) => r.json()),
      fetch(`/api/bank-accounts/analytics/merchants?${qs}&limit=10`).then((r) => r.json()),
    ]);
    setSummary(s);
    setCategories(c.categories);
    setMerchants(m.merchants);
    setLoading(false);
  }, [year, month, accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function drillToList(extra: Record<string, string>) {
    const qs = new URLSearchParams(extra);
    if (accountId) qs.set("accountId", accountId);
    router.push(`/dashboard/bank-accounts/list?${qs}`);
  }

  const mmStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const mmEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  // Derive previous month totals from monthTrend for StatCards deltas.
  const currentKey = `${year}-${String(month).padStart(2, "0")}`;
  const prevDate = new Date(year, month - 2, 1);
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevRow = summary?.monthTrend.find((r) => r.month === prevKey);
  const prevStats = prevRow
    ? { spending: prevRow.spending, income: prevRow.income, net: prevRow.income - prevRow.spending, count: 0 }
    : undefined;

  const hasAnyData = !loading && summary && (summary.stats.count > 0 || summary.monthTrend.some((r) => r.spending > 0 || r.income > 0));

  if (!loading && !hasAnyData) {
    return (
      <div className="space-y-6">
        <Toolbar
          year={year}
          month={month}
          accountId={accountId}
          accounts={accounts}
          onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
          onAccountChange={setAccountId}
        />
        <div className="ab-card p-10 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-[#2a1218] flex items-center justify-center mx-auto mb-5">
            <Landmark size={22} className="text-[#ff385c]" />
          </div>
          <p className="text-[20px] font-semibold text-[#ededed] tracking-tight">No transactions for {monthName(year, month)}</p>
          <p className="text-[14px] text-[#a0a0a5] mt-2 mb-6">Import a statement or pick a different month to see analytics.</p>
          <a href="/dashboard/bank-accounts/import" className="ab-btn ab-btn-accent inline-flex">Import Statement</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar
        year={year}
        month={month}
        accountId={accountId}
        accounts={accounts}
        onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
        onAccountChange={setAccountId}
      />

      <StatCards {...(summary?.stats ?? { spending: 0, income: 0, net: 0, count: 0 })} prev={prevStats} />

      {/* Row 1: Spending by Category list matches the MonthTrendChart's
          natural height and scrolls internally when categories overflow. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <CategoryBreakdownChart
          data={categories}
          onSelect={(categoryId) => drillToList({ from: mmStart, to: mmEnd, ...(categoryId ? { categoryId } : {}) })}
          maxHeight={trendHeight}
        />
        <div ref={trendRef}>
          <MonthTrendChart
            data={summary?.monthTrend ?? []}
            onMonthClick={(m) => { const [y, mm] = m.split("-").map(Number); setYear(y); setMonth(mm); }}
          />
        </div>
      </div>

      {/* Row 2: Top Merchants + Daily Spending share a fixed row height.
          Heatmap sets its natural height (just enough to fit the calendar),
          and Top Merchants is capped to the same height via ResizeObserver,
          scrolling internally when it overflows. `items-start` stops grid
          from stretching the heatmap past its content. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <TopMerchantsList items={merchants} maxHeight={heatmapHeight} />
        <div ref={heatmapRef}>
          <DailyHeatmap
            year={year} month={month}
            data={summary?.heatmap ?? {}}
            onDayClick={(iso) => drillToList({ from: iso, to: iso })}
          />
        </div>
      </div>
      <IncomeExpenseChart data={summary?.incomeExpense ?? []} />

      {/* Subtle indicator for the current month/account context */}
      <p className="text-[11px] text-[#6e6e73] text-center">
        Showing {monthName(year, month)}
        {accountId ? ` · ${accounts.find((a) => a.id === accountId)?.label ?? "Account"}` : " · all accounts"}
        {prevRow ? ` · compared to ${monthName(prevDate.getFullYear(), prevDate.getMonth() + 1)}` : ""}
      </p>
    </div>
  );
}

function monthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function Toolbar({
  year,
  month,
  accountId,
  accounts,
  onMonthChange,
  onAccountChange,
}: {
  year: number;
  month: number;
  accountId: string;
  accounts: { id: string; label: string }[];
  onMonthChange: (y: number, m: number) => void;
  onAccountChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <MonthPicker year={year} month={month} onChange={onMonthChange} />
      <select
        className="ab-input max-w-[220px]"
        value={accountId}
        onChange={(e) => onAccountChange(e.target.value)}
      >
        <option value="">All accounts</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
    </div>
  );
}
