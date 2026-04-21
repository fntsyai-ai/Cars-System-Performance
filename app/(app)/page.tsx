import { getMonthlySummary, getLast12MonthsTrend, getYtdProfit } from "@/lib/queries";
import { formatCAD, formatMonthLabel, formatNumber, formatPercent, parseMonthParam } from "@/lib/utils";
import { KpiCard } from "@/components/kpi-card";
import { Funnel } from "@/components/funnel";
import { MonthSelector } from "@/components/month-selector";
import { ProfitTrendChart, StageBarChart } from "@/components/trend-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthParam(params.m);

  const [summary, trend, ytd] = await Promise.all([
    getMonthlySummary(month),
    getLast12MonthsTrend(month),
    getYtdProfit(month),
  ]);

  return (
    <div className="px-10 py-8 max-w-[1600px]">
      <header className="flex items-end justify-between mb-10 rise rise-0">
        <div>
          <div className="eyebrow mb-3">Section I · Monthly Ledger</div>
          <h1 className="font-display text-[56px] leading-none text-ink-900">
            Dashboard<span className="text-clay-500">.</span>
          </h1>
          <p className="mt-3 text-ink-600 text-[14.5px] max-w-[48ch]">
            {formatMonthLabel(month)} — the numbers, as they stand.
          </p>
        </div>
        <MonthSelector value={month} />
      </header>

      <section className="card rounded-sm grid grid-cols-6 rise rise-1 overflow-hidden">
        <KpiCard
          label="Found · Telegram"
          value={formatNumber(summary.telegramFound)}
          sub={summary.dealLogFound ? `${summary.dealLogFound} tracked in ledger` : "auto-tracked"}
          numeral="01"
        />
        <KpiCard
          label="Approved"
          value={formatNumber(summary.approved)}
          sub={`${formatPercent(summary.foundToApproved)} of tracked deals`}
          numeral="02"
        />
        <KpiCard
          label="Bought"
          value={formatNumber(summary.bought)}
          sub={`${formatPercent(summary.approvedToBought)} of approved`}
          numeral="03"
          accent="clay"
        />
        <KpiCard
          label="Profit · Month"
          value={formatCAD(summary.totalProfit)}
          sub="realized CAD"
          numeral="04"
          accent={summary.totalProfit >= 0 ? "sage" : "rust"}
        />
        <KpiCard
          label="Avg · per deal"
          value={summary.avgProfit != null ? formatCAD(summary.avgProfit) : "—"}
          sub={summary.bought ? `${summary.bought} deals` : "no sales yet"}
          numeral="05"
        />
        <KpiCard
          label="Year to Date"
          value={formatCAD(ytd)}
          sub={String(month.year)}
          numeral="06"
          accent="clay"
        />
      </section>

      <section className="grid grid-cols-[1.2fr_1fr] gap-8 mt-12 rise rise-2">
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="font-display text-[28px] text-ink-900 mt-1">Flow of the month</h2>
            </div>
            <div className="font-mono text-[11px] text-ink-500 tabular">
              {summary.dealLogFound} tracked
            </div>
          </div>
          <div className="card rounded-sm p-8">
            <Funnel
              found={summary.dealLogFound}
              approved={summary.approved}
              bought={summary.bought}
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <div className="eyebrow">Conversion</div>
              <h2 className="font-display text-[28px] text-ink-900 mt-1">Passage rates</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-ink-900/[0.08] rounded-sm overflow-hidden">
            <ConversionTile
              label="Found → Approved"
              value={formatPercent(summary.foundToApproved, 1)}
            />
            <ConversionTile
              label="Approved → Bought"
              value={formatPercent(summary.approvedToBought, 1)}
              accent
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 mt-12 rise rise-3">
        <ChartPanel title="Profit · trailing 12 months" subtitle="monthly realized CAD">
          <ProfitTrendChart data={trend} />
        </ChartPanel>
        <ChartPanel title="Pipeline by month" subtitle="found · approved · bought">
          <StageBarChart data={trend} />
        </ChartPanel>
      </section>

      <footer className="mt-20 flex items-center justify-between text-ink-400 hairline-t pt-6">
        <div className="eyebrow">End of ledger — {formatMonthLabel(month)}</div>
        <div className="eyebrow">Private · No. 001</div>
      </footer>
    </div>
  );
}

function ConversionTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper-100 p-8">
      <div className="eyebrow mb-6">{label}</div>
      <div className={`font-display text-[72px] leading-none tabular ${accent ? "text-clay-500" : "text-ink-900"}`}>
        {value}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="eyebrow">{title.split("·")[0]?.trim()}</div>
          <h2 className="font-display text-[24px] text-ink-900 mt-1">{title}</h2>
        </div>
        <div className="eyebrow">{subtitle}</div>
      </div>
      <div className="card rounded-sm p-4">
        {children}
      </div>
    </div>
  );
}
