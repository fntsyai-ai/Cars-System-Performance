import { getAnalyticsByMake, getAnalyticsByProvince } from "@/lib/queries";
import { formatCAD, formatNumber, CANADIAN_PROVINCES } from "@/lib/utils";

export default async function AnalyticsPage() {
  const [byMake, byProv] = await Promise.all([
    getAnalyticsByMake(),
    getAnalyticsByProvince(),
  ]);

  const topMakeProfit = Math.max(...byMake.map((m) => m.totalProfit), 1);
  const topProvProfit = Math.max(...byProv.map((p) => p.totalProfit), 1);

  return (
    <div className="px-4 py-6 md:px-10 md:py-8 max-w-[1600px]">
      <header className="mb-10 md:mb-12 rise rise-0">
        <div className="eyebrow mb-3">Section III · Analytics</div>
        <h1 className="font-display text-[40px] md:text-[56px] leading-none text-ink-900">
          Patterns<span className="text-clay-500">.</span>
        </h1>
        <p className="mt-3 text-ink-600 text-[14.5px] max-w-[54ch]">
          Where the profit actually comes from — by make and by province.
        </p>
      </header>

      <section className="mb-16 md:mb-20 rise rise-1">
        <div className="flex items-baseline justify-between mb-5 hairline-b pb-3">
          <div>
            <div className="eyebrow">Breakdown</div>
            <h2 className="font-display text-[24px] md:text-[32px] text-ink-900 mt-1">By Make</h2>
          </div>
          <div className="eyebrow">{byMake.length} makes tracked</div>
        </div>

        {byMake.length === 0 ? (
          <Empty />
        ) : (
          <div className="card rounded-sm overflow-x-auto"><div className="min-w-[820px]">
            <HeaderRow columns={["Make", "Found", "Approved", "Bought", "Total Profit", "Avg / Deal", "Share"]} />
            {byMake.map((m, i) => (
              <DataRow
                key={m.make}
                cells={[
                  <span key="n" className="font-display text-[18px] text-ink-900">{m.make}</span>,
                  formatNumber(m.found),
                  formatNumber(m.approved),
                  <span key="b" className="text-clay-500">{formatNumber(m.bought)}</span>,
                  <span key="p" className={m.totalProfit >= 0 ? "text-sage-500" : "text-rust-500"}>{formatCAD(m.totalProfit)}</span>,
                  m.avgProfit != null ? formatCAD(m.avgProfit) : "—",
                  <Bar key="bar" value={m.totalProfit} max={topMakeProfit} />,
                ]}
                index={i}
              />
            ))}
          </div></div>
        )}
      </section>

      <section className="rise rise-2">
        <div className="flex items-baseline justify-between mb-5 hairline-b pb-3">
          <div>
            <div className="eyebrow">Geography</div>
            <h2 className="font-display text-[24px] md:text-[32px] text-ink-900 mt-1">By Province</h2>
          </div>
          <div className="eyebrow">{byProv.length} provinces tracked</div>
        </div>

        {byProv.length === 0 ? (
          <Empty />
        ) : (
          <div className="card rounded-sm overflow-x-auto"><div className="min-w-[720px]">
            <HeaderRow columns={["Province", "Found", "Bought", "Total Profit", "Avg / Deal", "Share"]} gridClass="grid-cols-[1.3fr_1fr_1fr_1.3fr_1fr_1.4fr]" />
            {byProv.map((p, i) => {
              const name = CANADIAN_PROVINCES.find((x) => x.code === p.province)?.name ?? p.province;
              return (
                <DataRow
                  key={p.province}
                  gridClass="grid-cols-[1.3fr_1fr_1fr_1.3fr_1fr_1.4fr]"
                  cells={[
                    <span key="n" className="flex items-baseline gap-3">
                      <span className="font-mono text-clay-500 text-[13px]">{p.province}</span>
                      <span className="font-display text-[16px] text-ink-900">{name}</span>
                    </span>,
                    formatNumber(p.found),
                    <span key="b" className="text-clay-500">{formatNumber(p.bought)}</span>,
                    <span key="p" className={p.totalProfit >= 0 ? "text-sage-500" : "text-rust-500"}>{formatCAD(p.totalProfit)}</span>,
                    p.avgProfit != null ? formatCAD(p.avgProfit) : "—",
                    <Bar key="bar" value={p.totalProfit} max={topProvProfit} />,
                  ]}
                  index={i}
                />
              );
            })}
          </div></div>
        )}
      </section>
    </div>
  );
}

function HeaderRow({ columns, gridClass }: { columns: string[]; gridClass?: string }) {
  return (
    <div className={`grid ${gridClass ?? "grid-cols-[1.3fr_1fr_1fr_1fr_1.3fr_1fr_1.4fr]"} hairline-b bg-ink-900/[0.025]`}>
      {columns.map((c, i) => (
        <div key={i} className={`px-4 py-3 eyebrow ${i === 0 ? "" : "text-right"}`}>{c}</div>
      ))}
    </div>
  );
}

function DataRow({
  cells,
  index,
  gridClass,
}: {
  cells: React.ReactNode[];
  index: number;
  gridClass?: string;
}) {
  return (
    <div className={`grid ${gridClass ?? "grid-cols-[1.3fr_1fr_1fr_1fr_1.3fr_1fr_1.4fr]"} hairline-b last:border-b-0 hover:bg-ink-900/[0.02] transition-colors`}>
      {cells.map((c, i) => (
        <div
          key={i}
          className={`px-4 py-4 text-[13px] font-mono tabular text-ink-800 ${i === 0 ? "" : "text-right"} flex items-center ${i === 0 ? "" : "justify-end"}`}
        >
          {i === 0 && (
            <span className="font-mono text-[10px] text-ink-400 mr-3 w-6">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {c}
        </div>
      ))}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full h-[4px] bg-ink-900/[0.06] relative overflow-hidden rounded-full">
      <div
        className="absolute inset-y-0 left-0 bg-clay-500 transition-[width] duration-700 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Empty() {
  return (
    <div className="card rounded-sm p-16 text-center">
      <div className="eyebrow mb-2">No data yet</div>
      <div className="text-ink-500 text-[13px]">
        Add deals in the Deal Log and patterns will appear here.
      </div>
    </div>
  );
}
