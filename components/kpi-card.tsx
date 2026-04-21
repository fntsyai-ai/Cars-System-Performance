import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  numeral,
  accent,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  numeral?: string;
  accent?: "clay" | "sage" | "rust" | "default";
  className?: string;
}) {
  const accentColor = {
    clay: "text-clay-500",
    sage: "text-sage-500",
    rust: "text-rust-500",
    default: "text-ink-900",
  }[accent ?? "default"];

  return (
    <div className={cn("kpi group relative p-4 md:p-6 border-b md:border-b-0 border-ink-900/[0.08] md:hairline-r md:last:border-r-0 [&:nth-child(even)]:border-l md:[&:nth-child(even)]:border-l-0 [&:nth-child(even)]:border-ink-900/[0.08]", className)}>
      <div className="flex items-start justify-between mb-3 md:mb-4">
        <div className="eyebrow">{label}</div>
        {numeral && (
          <div className="font-mono text-[10px] text-ink-400">{numeral}</div>
        )}
      </div>
      <div className={cn("kpi-value font-display text-[32px] md:text-[52px] leading-none tabular", accentColor)}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 md:mt-3 font-mono text-[11px] text-ink-500 tabular">
          {sub}
        </div>
      )}
    </div>
  );
}
