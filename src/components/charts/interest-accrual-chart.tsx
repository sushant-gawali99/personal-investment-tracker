"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

interface DataPoint {
  month: string;
  accrued: number;
  projected: number;
}

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

export function InterestAccrualChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return null;

  const nowIdx = data.findIndex((d) => d.projected === 0 && data[data.indexOf(d) + 1]?.projected > 0);
  const todayLabel = nowIdx >= 0 ? data[nowIdx]?.month : undefined;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="accrued" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00dfc1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#00dfc1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="projected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00dfc1" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#00dfc1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(73,69,78,0.15)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#cbc4d0" }} tickLine={false} axisLine={false} interval={3} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#cbc4d0" }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          formatter={(value, name) => [fmt(Number(value)), name === "accrued" ? "Accrued" : "Projected"]}
          contentStyle={{ background: "#1f1f22", border: "1px solid rgba(73,69,78,0.2)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#cbc4d0" }}
        />
        {todayLabel && <ReferenceLine x={todayLabel} stroke="rgba(73,69,78,0.4)" strokeDasharray="4 4" label={{ value: "Today", fontSize: 10, fill: "#cbc4d0", position: "top" }} />}
        <Area type="monotone" dataKey="accrued" stroke="#00dfc1" strokeWidth={2} fill="url(#accrued)" dot={false} animationDuration={600} />
        <Area type="monotone" dataKey="projected" stroke="#00dfc1" strokeWidth={1.5} fill="url(#projected)" dot={false} strokeDasharray="5 5" animationDuration={600} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
