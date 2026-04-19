"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  equityValue: number;
  fdValue: number;
  mfValue?: number;
  centerLabel?: string;
  centerValue?: string;
}

const COLORS = ["#ff385c", "#5aa9ff", "#5ee0a4"];

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
    return <div className="flex items-center justify-center h-full text-[#a0a0a5] text-sm">No data</div>;
  }

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            dataKey="value"
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#17171a" strokeWidth={3} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [fmt(Number(value)), ""]} />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && <p className="text-[10px] text-[#a0a0a5] uppercase tracking-widest font-semibold">{centerLabel}</p>}
          {centerValue && <p className="mono text-[15px] font-bold text-[#ededed] mt-0.5">{centerValue}</p>}
        </div>
      )}
    </div>
  );
}
