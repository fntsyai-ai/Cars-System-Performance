import { cn } from "@/lib/utils";

export function Funnel({
  found,
  approved,
  bought,
}: {
  found: number;
  approved: number;
  bought: number;
}) {
  const max = Math.max(found, approved, bought, 1);
  const pct = (n: number) => Math.max((n / max) * 100, found + approved + bought === 0 ? 0 : 6);

  const rows = [
    { label: "Found", value: found, numeral: "I", width: pct(found), color: "bg-ink-900/25" },
    { label: "Approved", value: approved, numeral: "II", width: pct(approved), color: "bg-clay-400" },
    { label: "Bought", value: bought, numeral: "III", width: pct(bought), color: "bg-clay-500" },
  ];

  return (
    <div className="space-y-5">
      {rows.map((r, i) => (
        <div key={r.label} className={cn("rise", `rise-${i}`)}>
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] text-ink-400">{r.numeral}</span>
              <span className="eyebrow">{r.label}</span>
            </div>
            <div className="font-display text-[28px] text-ink-900 tabular leading-none">
              {r.value}
            </div>
          </div>
          <div className="relative h-[6px] bg-ink-900/[0.06] rounded-full overflow-hidden">
            <div
              className={cn("absolute inset-y-0 left-0 transition-[width] duration-700 ease-out rounded-full", r.color)}
              style={{ width: `${r.width}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
