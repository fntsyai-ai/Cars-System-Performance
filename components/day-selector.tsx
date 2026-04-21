"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDayLabel, formatDayParam, isToday, shiftDay, type DayRef } from "@/lib/utils";

export function DaySelector({ value }: { value: DayRef }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function nav(dir: -1 | 1) {
    const next = shiftDay(value, dir);
    const params = new URLSearchParams(searchParams.toString());
    params.set("d", formatDayParam(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("d");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1 card-subtle px-1.5 py-1 rounded-sm">
      <button
        onClick={() => nav(-1)}
        className="w-8 h-8 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={15} strokeWidth={1.6} />
      </button>
      <div className="px-4 min-w-[210px] text-center">
        <div className="eyebrow">Intake Day</div>
        <div className="font-display text-[20px] text-ink-900 leading-tight">
          {formatDayLabel(value)}
        </div>
      </div>
      <button
        onClick={() => nav(1)}
        className="w-8 h-8 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
        aria-label="Next day"
      >
        <ChevronRight size={15} strokeWidth={1.6} />
      </button>
      {!isToday(value) && (
        <button
          onClick={goToday}
          className="ml-1 px-2.5 py-1 text-[10px] eyebrow !text-clay-500 hover:!text-clay-600 border border-clay-500/30 hover:border-clay-500/60 transition-colors rounded-sm"
        >
          Today
        </button>
      )}
    </div>
  );
}
