// src/app/dashboard/bank-accounts/overview-client.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  const fetchAll = useCallback(async () => {
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
  }, [year, month, accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function drillToList(extra: Record<string, string>) {
    const qs = new URLSearchParams(extra);
    if (accountId) qs.set("accountId", accountId);
    router.push(`/dashboard/bank-accounts/list?${qs}`);
  }

  const mmStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const mmEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <select className="ab-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <StatCards {...(summary?.stats ?? { spending: 0, income: 0, net: 0, count: 0 })} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownChart
          data={categories}
          onSelect={(categoryId) => drillToList({ from: mmStart, to: mmEnd, ...(categoryId ? { categoryId } : {}) })}
        />
        <MonthTrendChart
          data={summary?.monthTrend ?? []}
          onMonthClick={(m) => { const [y, mm] = m.split("-").map(Number); setYear(y); setMonth(mm); }}
        />
        <TopMerchantsList items={merchants} />
        <DailyHeatmap
          year={year} month={month}
          data={summary?.heatmap ?? {}}
          onDayClick={(iso) => drillToList({ from: iso, to: iso })}
        />
      </div>
      <IncomeExpenseChart data={summary?.incomeExpense ?? []} />
    </div>
  );
}
