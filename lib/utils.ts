import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const APP_TIME_ZONE = "America/Edmonton";

export type MonthRef = {
  year: number;
  month: number;
};

export type DayRef = {
  year: number;
  month: number;
  day: number;
};

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

const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAY_SHORT_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

function getTimeZoneParts(date: Date, timeZone = APP_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  input: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone = APP_TIME_ZONE,
) {
  const guess = new Date(
    Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour ?? 0,
      input.minute ?? 0,
      input.second ?? 0,
    ),
  );
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getCurrentMonthRef(): MonthRef {
  const now = getTimeZoneParts(new Date());
  return { year: now.year, month: now.month };
}

export function getCurrentDayRef(): DayRef {
  const now = getTimeZoneParts(new Date());
  return { year: now.year, month: now.month, day: now.day };
}

export function parseMonthParam(param: string | null | undefined): MonthRef {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [yearStr, monthStr] = param.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (year >= 2000 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return getCurrentMonthRef();
}

export function formatMonthParam(month: MonthRef) {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

export function shiftMonth(month: MonthRef, delta: number): MonthRef {
  const totalMonths = month.year * 12 + (month.month - 1) + delta;
  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12 + 12) % 12 + 1,
  };
}

export function formatMonthLabel(month: MonthRef) {
  return `${MONTH_NAMES[month.month - 1]} ${month.year}`;
}

export function formatMonthShortLabel(month: MonthRef) {
  return MONTH_SHORT_NAMES[month.month - 1];
}

export function isCurrentMonth(month: MonthRef) {
  const current = getCurrentMonthRef();
  return current.year === month.year && current.month === month.month;
}

export function getMonthDateRange(month: MonthRef) {
  const start = `${formatMonthParam(month)}-01`;
  const end = `${formatMonthParam(month)}-${String(daysInMonth(month.year, month.month)).padStart(2, "0")}`;
  return { start, end };
}

export function getMonthUtcRange(month: MonthRef) {
  const start = zonedDateTimeToUtc({ year: month.year, month: month.month, day: 1, hour: 0, minute: 0, second: 0 });
  const next = shiftMonth(month, 1);
  const end = zonedDateTimeToUtc({ year: next.year, month: next.month, day: 1, hour: 0, minute: 0, second: 0 });
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getYearStartDate(month: MonthRef) {
  return `${month.year}-01-01`;
}

export function getTodayDateInAppTimeZone() {
  const today = getTimeZoneParts(new Date());
  return `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

export function getCurrentYearInAppTimeZone() {
  return getTimeZoneParts(new Date()).year;
}

export function parseDayParam(param: string | null | undefined): DayRef {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [yearStr, monthStr, dayStr] = param.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return { year, month, day };
    }
  }
  return getCurrentDayRef();
}

export function formatDayParam(day: DayRef) {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export function shiftDay(day: DayRef, delta: number): DayRef {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + delta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function isToday(day: DayRef) {
  const today = getCurrentDayRef();
  return today.year === day.year && today.month === day.month && today.day === day.day;
}

export function formatDayLabel(day: DayRef) {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day));
  return `${WEEKDAY_SHORT_NAMES[date.getUTCDay()]}, ${MONTH_SHORT_NAMES[day.month - 1]} ${day.day}, ${day.year}`;
}

export function getDayUtcRange(day: DayRef) {
  const start = zonedDateTimeToUtc({ year: day.year, month: day.month, day: day.day, hour: 0, minute: 0, second: 0 });
  const next = shiftDay(day, 1);
  const end = zonedDateTimeToUtc({ year: next.year, month: next.month, day: next.day, hour: 0, minute: 0, second: 0 });
  return { start: start.toISOString(), end: end.toISOString() };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCAD(n: number | null | undefined, opts: { sign?: boolean } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
  if (opts.sign && n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted.replace("-", "")}`;
  return formatted;
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-CA");
}

export function formatPercent(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export const CANADIAN_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland & Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

export type UIStatus =
  | "found"
  | "approved"
  | "bought"
  | "no_deal"
  | "dealer_didnt_negotiate"
  | "already_sold"
  | "bad_spec"
  | "other";

export type Stage = UIStatus;

type DealProfitSnapshot = {
  ui_status: UIStatus;
  price?: number | null;
  profit_cad?: number | null;
  profit_margin?: number | null;
};

export const STAGE_LABELS: Record<Stage, string> = {
  found: "Found",
  approved: "Approved",
  bought: "Bought",
  no_deal: "Bad Dealer",
  dealer_didnt_negotiate: "Dealer Didn’t Negotiate",
  already_sold: "Already Sold",
  bad_spec: "Bad Spec/Damage",
  other: "Other",
};

export const UI_STATUS_LABELS: Record<UIStatus, string> = {
  found: "Found",
  approved: "Approved",
  bought: "Bought",
  no_deal: "Bad Dealer",
  dealer_didnt_negotiate: "Dealer Didn’t Negotiate",
  already_sold: "Already Sold",
  bad_spec: "Bad Spec/Damage",
  other: "Other",
};

export function isApprovedStageStatus(status: UIStatus) {
  return (
    status === "approved" ||
    status === "bought" ||
    status === "no_deal" ||
    status === "dealer_didnt_negotiate" ||
    status === "already_sold" ||
    status === "bad_spec" ||
    status === "other"
  );
}

export function isBoughtDealAwaitingPayment(deal: DealProfitSnapshot) {
  return deal.ui_status === "bought" && (deal.profit_cad == null || deal.profit_cad === 0);
}

export function getRealizedDealProfit(deal: DealProfitSnapshot) {
  if (deal.ui_status !== "bought") return null;
  if (isBoughtDealAwaitingPayment(deal)) return null;
  if (deal.profit_cad != null) return Number(deal.profit_cad);
  return null;
}
