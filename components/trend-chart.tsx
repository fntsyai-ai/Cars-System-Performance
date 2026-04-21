"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";

type Row = { label: string; profit: number; bought: number; approved: number; found: number };

const TERRACOTTA = "#b8693d";
const TERRACOTTA_LIGHT = "#cd8150";
const PARCHMENT_SOFT = "rgba(232, 223, 203, 0.22)";
const GRID = "rgba(232, 223, 203, 0.08)";

export function ProfitTrendChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TERRACOTTA} stopOpacity={0.4} />
            <stop offset="100%" stopColor={TERRACOTTA} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(184,105,61,0.35)", strokeWidth: 1 }} />
        <Area type="monotone" dataKey="profit" stroke={TERRACOTTA} strokeWidth={1.75} fill="url(#profitGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StageBarChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(184,105,61,0.06)" }} />
        <Legend content={<ChartLegend />} />
        <Bar dataKey="found" stackId="a" fill={PARCHMENT_SOFT} />
        <Bar dataKey="approved" stackId="a" fill={TERRACOTTA_LIGHT} />
        <Bar dataKey="bought" stackId="a" fill={TERRACOTTA} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="card p-3 min-w-[140px]">
      <div className="eyebrow mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-[12px]">
          <span className="flex items-center gap-2 text-ink-700">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
            <span className="capitalize">{p.dataKey}</span>
          </span>
          <span className="font-mono tabular text-ink-900">
            {typeof p.value === "number" && p.dataKey === "profit"
              ? `$${p.value.toLocaleString()}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex gap-4 justify-end mt-2">
      {payload.map((p: any) => (
        <div key={p.value} className="flex items-center gap-1.5 text-[10px] eyebrow">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          {p.value}
        </div>
      ))}
    </div>
  );
}
