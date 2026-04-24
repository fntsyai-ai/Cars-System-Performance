"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatDayLabel,
  formatDayParam,
  getCurrentDayRef,
  isToday,
  shiftDay,
  type DayRef,
} from "@/lib/utils";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sameDay(a: DayRef, b: DayRef) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function DaySelector({ value }: { value: DayRef }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.year);
  const [viewMonth, setViewMonth] = useState(value.month);
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setViewYear(value.year);
      setViewMonth(value.month);
    }
  }, [open, value.year, value.month]);

  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchorRect({ top: rect.bottom, right: window.innerWidth - rect.right });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function pushDay(next: DayRef) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("d", formatDayParam(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  function nav(dir: -1 | 1) {
    pushDay(shiftDay(value, dir));
  }

  function goToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("d");
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function shiftView(delta: number) {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth((total % 12 + 12) % 12 + 1);
  }

  function selectDay(day: number) {
    pushDay({ year: viewYear, month: viewMonth, day });
    setOpen(false);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = getCurrentDayRef();

  const popover = open && mounted && anchorRect ? createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 2147483000 }}
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Select date"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute rounded-sm p-3 w-[280px] border"
        style={{
          top: anchorRect.top + 8,
          right: anchorRect.right,
          background: "var(--cypress-raised, #2a3530)",
          borderColor: "var(--hairline, rgba(232,223,203,0.12))",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => shiftView(-1)}
            className="w-7 h-7 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} strokeWidth={1.6} />
          </button>
          <div className="font-display text-[14px] text-ink-900">
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </div>
          <button
            type="button"
            onClick={() => shiftView(1)}
            className="w-7 h-7 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={14} strokeWidth={1.6} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAY_HEADERS.map((d, i) => (
            <div key={i} className="eyebrow text-center text-[9px] py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const cellRef: DayRef = { year: viewYear, month: viewMonth, day };
            const selected = sameDay(cellRef, value);
            const isTodayCell = sameDay(cellRef, today);
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectDay(day)}
                className={[
                  "h-8 text-[13px] rounded-sm transition-colors font-mono",
                  selected
                    ? "bg-clay-500 text-white"
                    : isTodayCell
                      ? "text-clay-500 ring-1 ring-clay-500/40 hover:bg-ink-900/[0.04]"
                      : "text-ink-900 hover:bg-ink-900/[0.04]",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="flex items-center gap-1 card-subtle px-1.5 py-1 rounded-sm">
      <button
        onClick={() => nav(-1)}
        className="w-8 h-8 flex items-center justify-center text-ink-700 hover:text-clay-500 hover:bg-ink-900/[0.04] rounded-sm transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={15} strokeWidth={1.6} />
      </button>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-4 min-w-[210px] text-center rounded-sm hover:bg-ink-900/[0.04] transition-colors cursor-pointer"
        aria-label="Pick a date"
        aria-expanded={open}
      >
        <div className="eyebrow">Intake Day</div>
        <div className="font-display text-[20px] text-ink-900 leading-tight">
          {formatDayLabel(value)}
        </div>
      </button>
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
      {popover}
    </div>
  );
}
