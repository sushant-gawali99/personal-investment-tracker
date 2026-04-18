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
  return <circle cx={cx} cy={cy} r={4} fill="#00dfc1" stroke="#0e0e11" strokeWidth={2} />;
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
      {/* Milestone badges */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {milestoneData.map((d) => (
          <div key={d.year} className="bg-[#0e0e11] rounded-lg p-2.5 text-center border border-[rgba(73,69,78,0.2)]">
            <p className="text-[10px] text-[#cbc4d0] uppercase tracking-wider font-label">{d.year}</p>
            <p className="mono text-xs font-bold text-[#e4e1e6] mt-1">{formatINRCompact(d.value)}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00dfc1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00dfc1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(73,69,78,0.15)" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#cbc4d0" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatINRCompact(v)}
            tick={{ fontSize: 11, fill: "#cbc4d0" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value) => [formatINRCompact(Number(value)), "Projected Wealth"]}
            contentStyle={{
              background: "#1f1f22",
              border: "1px solid rgba(73,69,78,0.2)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#cbc4d0" }}
          />
          <ReferenceLine
            x="Now"
            stroke="rgba(73,69,78,0.4)"
            strokeDasharray="4 4"
            label={{ value: "Today", fontSize: 10, fill: "#cbc4d0", position: "top" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#00dfc1"
            strokeWidth={2}
            fill="url(#wealthGrad)"
            dot={<MilestoneDot />}
            activeDot={{ r: 5, fill: "#00dfc1" }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-[#cbc4d0]/60 text-center">
        Assumes {cagr.toFixed(2)}% CAGR maintained — actual returns may vary
      </p>
    </div>
  );
}
