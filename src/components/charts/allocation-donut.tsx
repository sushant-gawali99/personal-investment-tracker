"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  equityValue: number;
  fdValue: number;
  mfValue?: number;
  centerLabel?: string;
  centerValue?: string;
}

const COLORS = ["#8b7fb0", "#6b8ca0", "#b08795"];

function fmt(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function AllocationDonut({ equityValue, fdValue, mfValue = 0, centerLabel, centerValue }: Props) {
  const data = [
    { name: "Equity", value: Math.round(equityValue) },
    { name: "Mutual Funds", value: Math.round(mfValue) },
    { name: "Fixed Deposits", value: Math.round(fdValue) },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-full text-[#cbc4d0] text-sm">No data</div>;
  }

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            dataKey="value"
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#0e0e11" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [fmt(Number(value)), ""]}
            contentStyle={{ background: "#1f1f22", border: "1px solid rgba(73,69,78,0.4)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#cbc4d0" }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && <p className="text-[9px] text-[#cbc4d0] uppercase tracking-widest font-label">{centerLabel}</p>}
          {centerValue && <p className="mono text-sm font-bold text-[#e4e1e6] mt-0.5">{centerValue}</p>}
        </div>
      )}
    </div>
  );
}
