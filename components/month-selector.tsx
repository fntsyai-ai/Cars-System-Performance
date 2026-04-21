"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel, formatMonthParam, isCurrentMonth, shiftMonth, type MonthRef } from "@/lib/utils";

export function MonthSelector({ value }: { value: MonthRef }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function nav(dir: -1 | 1) {
    const next = shiftMonth(value, dir);
    const params = new URLSearchParams(searchParams.toString());
    params.set("m", formatMonthParam(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  function goCurrent() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("m");
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  const isCurrent = isCurrentMonth(value);

  return (
    <div className="flex items-center gap-1 card-subtle px-1.5 py-1 rounded-sm">
      <button
        onClick={() => nav(-1)}
        className="w-8 h-8 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft size={15} strokeWidth={1.6} />
      </button>
      <div className="px-4 min-w-[180px] text-center">
        <div className="eyebrow">Period</div>
        <div className="font-display text-[22px] text-ink-900 leading-tight">
          {formatMonthLabel(value)}
        </div>
      </div>
      <button
        onClick={() => nav(1)}
        className="w-8 h-8 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
        aria-label="Next month"
      >
        <ChevronRight size={15} strokeWidth={1.6} />
      </button>
      {!isCurrent && (
        <button
          onClick={goCurrent}
          className="ml-1 px-2.5 py-1 text-[10px] eyebrow !text-clay-500 hover:!text-clay-600 border border-clay-500/30 hover:border-clay-500/60 transition-colors rounded-sm"
        >
          Today
        </button>
      )}
    </div>
  );
}
