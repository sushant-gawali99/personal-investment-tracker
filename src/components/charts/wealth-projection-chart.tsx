"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { formatINRCompact } from "@/lib/format";

const MILESTONES = [1, 2, 5, 8, 10];

function buildData(currentValue: number, cagr: number) {
  const rate = cagr / 100;
  const points = [];
  for (let y = 0; y <= 10; y++) {
    points.push({
      year: y === 0 ? "Now" : `Y${y}`,
      value: currentValue * Math.pow(1 + rate, y),
      isMilestone: y === 0 || MILESTONES.includes(y),
    });
  }
  return points;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: { isMilestone: boolean };
}

function MilestoneDot({ cx, cy, payload }: CustomDotProps) {
  if (!payload?.isMilestone) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#ff385c" stroke="#ffffff" strokeWidth={2} />;
}

export function WealthProjectionChart({
  currentValue,
  cagr,
}: {
  currentValue: number;
  cagr: number;
}) {
  const data = buildData(currentValue, cagr);
  const milestoneData = data.filter((d) => d.isMilestone);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {milestoneData.map((d) => (
          <div key={d.year} className="ab-card-flat p-2.5 text-center">
            <p className="text-[10px] text-[#6a6a6a] uppercase tracking-wider font-semibold">{d.year}</p>
            <p className="mono text-xs font-bold text-[#222222] mt-1">{formatINRCompact(d.value)}</p>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff385c" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ff385c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6a6a6a" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ fontSize: 11, fill: "#6a6a6a" }} tickLine={false} axisLine={false} width={56} />
          <Tooltip formatter={(value) => [formatINRCompact(Number(value)), "Projected Wealth"]} />
          <ReferenceLine x="Now" stroke="#c1c1c1" strokeDasharray="4 4" label={{ value: "Today", fontSize: 10, fill: "#6a6a6a", position: "top" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#ff385c"
            strokeWidth={2}
            fill="url(#wealthGrad)"
            dot={<MilestoneDot />}
            activeDot={{ r: 5, fill: "#ff385c" }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-[#929292] text-center">
        Assumes {cagr.toFixed(2)}% CAGR maintained — actual returns may vary
      </p>
    </div>
  );
}
