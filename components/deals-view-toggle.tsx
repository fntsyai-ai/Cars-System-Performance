"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn, formatDayParam, formatMonthParam, type DayRef, type MonthRef } from "@/lib/utils";

export function DealsViewToggle({
  value,
  day,
  month,
}: {
  value: "day" | "month";
  day: DayRef;
  month: MonthRef;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function push(next: "day" | "month") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    params.set("d", formatDayParam(day));
    params.set("m", formatMonthParam(month));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="card-subtle rounded-sm px-2 py-2 min-w-[170px]">
      <div className="px-2 pb-2 eyebrow">View</div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => push("day")}
          className={cn(
            "rounded-sm px-3 py-2.5 text-left transition-all",
            value === "day"
              ? "bg-clay-500/[0.14] text-ink-900 shadow-[inset_0_0_0_1px_rgba(184,105,61,0.28)]"
              : "text-ink-600 hover:bg-ink-900/[0.04] hover:text-ink-900",
          )}
        >
          <div className={cn("font-mono text-[10px] tabular", value === "day" ? "text-clay-500" : "text-ink-400")}>I</div>
          <div className="mt-1 font-display text-[18px] leading-none">Day</div>
        </button>
        <button
          type="button"
          onClick={() => push("month")}
          className={cn(
            "rounded-sm px-3 py-2.5 text-left transition-all",
            value === "month"
              ? "bg-clay-500/[0.14] text-ink-900 shadow-[inset_0_0_0_1px_rgba(184,105,61,0.28)]"
              : "text-ink-600 hover:bg-ink-900/[0.04] hover:text-ink-900",
          )}
        >
          <div className={cn("font-mono text-[10px] tabular", value === "month" ? "text-clay-500" : "text-ink-400")}>II</div>
          <div className="mt-1 font-display text-[18px] leading-none">Month</div>
        </button>
      </div>
    </div>
  );
}
