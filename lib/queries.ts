import { createClient } from "@/lib/supabase/server";
import {
  formatDayParam,
  formatMonthParam,
  formatMonthShortLabel,
  getMonthDateRange,
  getRealizedDealProfit,
  isApprovedStageStatus,
  normalizeUIStatus,
  shiftMonth,
  type DayRef,
  type MonthRef,
  type UIStatus,
} from "@/lib/utils";

export type ManualDeal = {
  id: string;
  listing_id: number | null;
  deal_date: string;
  vin: string | null;
  make: string;
  model: string | null;
  province: string | null;
  stage: UIStatus;
  ui_status: UIStatus;
  profit_cad: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Denormalized snapshot of car_listings (kept in sync by DB triggers).
  title: string | null;
  price: number | null;
  profit_margin: number | null;
  dealer_city: string | null;
  url: string | null;
  mmr_link: string | null;
  scraped_at: string | null;
  telegram_sent: string | null;
};

export type MonthlySummary = {
  month: string; // ISO month string YYYY-MM
  telegramFound: number;
  dealLogFound: number;
  approved: number;
  bought: number;
  unpaidBought: number;
  realizedBought: number;
  totalProfit: number;
  avgProfit: number | null;
  foundToApproved: number | null;
  approvedToBought: number | null;
};

// Legacy alias — previously represented a separate scraper row; now the
// manual_deals row carries the same fields inline.
export type UnifiedDeal = ManualDeal;

type DashboardBundle = {
  summary: MonthlySummary;
  trend: { month: string; label: string; profit: number; bought: number; approved: number; found: number }[];
  ytd: number;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

// Supabase / PostgREST caps every response at `db-max-rows` (1000 on this
// project) and that cap CANNOT be raised with `.limit()`. A plain
// `.select("*")` therefore silently returns an arbitrary 1000-row slice once
// the table grows past it — and with no `ORDER BY` the slice changes between
// requests. That broke the dashboard (under-counted "Bought") and made the
// YTD figure wobble on refresh. This helper pages through the full result set
// with a deterministic ordering so callers always see every matching row.
const SUPABASE_PAGE_SIZE = 1000;

async function fetchManualDealsInRange(
  startInclusive: string | null,
  endInclusive: string | null,
): Promise<ManualDeal[]> {
  const supabase = await createClient();
  const rows: ManualDeal[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    let filter = supabase.from("manual_deals").select("*");
    if (startInclusive) filter = filter.gte("deal_date", startInclusive);
    if (endInclusive) filter = filter.lte("deal_date", endInclusive);

    const { data, error } = await filter
      // Stable, fully-deterministic ordering (deal_date can tie, so break ties
      // on the primary key) keeps pagination consistent across pages.
      .order("deal_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;

    const page = data ?? [];
    for (const row of page) rows.push(normalizeDeal(row as Record<string, unknown>));
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

function normalizeDeal(row: Record<string, unknown>): ManualDeal {
  const uiStatus = normalizeUIStatus(typeof row.ui_status === "string" ? row.ui_status : null);
  const stage = normalizeUIStatus(typeof row.stage === "string" ? row.stage : row.ui_status as string | null);
  return {
    ...(row as ManualDeal),
    stage,
    ui_status: uiStatus,
    profit_cad: toNumber(row.profit_cad as number | string | null | undefined),
    price: toNumber(row.price as number | string | null | undefined),
    profit_margin: toNumber(row.profit_margin as number | string | null | undefined),
  };
}

// One aggregated row per month, as returned by the dashboard_monthly_metrics
// Postgres function (see supabase/migrations/012_dashboard_metrics.sql).
type MonthlyMetricsRow = {
  month: string; // "YYYY-MM"
  found: number;
  approved: number;
  bought: number;
  unpaid_bought: number;
  realized_count: number;
  realized_profit: number | string;
};

const EMPTY_METRICS = {
  found: 0,
  approved: 0,
  bought: 0,
  unpaid_bought: 0,
  realized_count: 0,
  realized_profit: 0,
} as const;

async function getDashboardBundle(month: MonthRef): Promise<DashboardBundle> {
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11));
  const earliestMonth = months[0];
  const monthStart = getMonthDateRange(earliestMonth).start;
  const monthEnd = getMonthDateRange(month).end;

  // Aggregate in Postgres — a single call returns ~12 rows instead of pulling
  // the whole table into the server. This also makes the result deterministic
  // (no row cap, no ordering ambiguity) by construction.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_monthly_metrics", {
    start_month: monthStart,
    end_month: monthEnd,
  });
  if (error) throw error;

  const byMonth = new Map<string, MonthlyMetricsRow>();
  for (const row of (data ?? []) as MonthlyMetricsRow[]) {
    byMonth.set(row.month, row);
  }

  const metricsFor = (key: string) => {
    const row = byMonth.get(key);
    if (!row) return EMPTY_METRICS;
    return {
      found: row.found,
      approved: row.approved,
      bought: row.bought,
      unpaid_bought: row.unpaid_bought,
      realized_count: row.realized_count,
      realized_profit: Number(row.realized_profit) || 0,
    };
  };

  const trend = months.map((monthRef) => {
    const key = formatMonthParam(monthRef);
    const m = metricsFor(key);
    return {
      month: key,
      label: formatMonthShortLabel(monthRef),
      profit: m.realized_profit,
      bought: m.bought,
      approved: m.approved,
      found: m.found,
    };
  });

  const currentKey = formatMonthParam(month);
  const current = metricsFor(currentKey);
  const totalProfit = current.realized_profit;

  // YTD is the sum of realized profit across this calendar year. The trailing
  // 12-month window always contains January→current month, so YTD is a slice
  // of the very same monthly rows the trend uses — they can never disagree.
  const ytd = trend
    .filter((row) => row.month.startsWith(`${month.year}-`))
    .reduce((sum, row) => sum + row.profit, 0);

  return {
    summary: {
      month: currentKey,
      // Every manual_deals row originates from a telegram-sent listing, so the
      // row count IS the telegram-found count for the period.
      telegramFound: current.found,
      dealLogFound: current.found,
      approved: current.approved,
      bought: current.bought,
      unpaidBought: current.unpaid_bought,
      realizedBought: current.realized_count,
      totalProfit,
      avgProfit: current.realized_count ? totalProfit / current.realized_count : null,
      foundToApproved: current.found ? (current.approved / current.found) * 100 : null,
      approvedToBought: current.approved ? (current.bought / current.approved) * 100 : null,
    },
    trend,
    ytd,
  };
}

export async function getMonthlySummary(month: MonthRef): Promise<MonthlySummary> {
  return (await getDashboardBundle(month)).summary;
}

export async function getLast12MonthsTrend(refDate: MonthRef) {
  return (await getDashboardBundle(refDate)).trend;
}

export async function getYtdProfit(refDate: MonthRef) {
  return (await getDashboardBundle(refDate)).ytd;
}

export async function getDealsForMonth(month: MonthRef): Promise<ManualDeal[]> {
  const { start, end } = getMonthDateRange(month);
  return fetchManualDealsInRange(start, end);
}

export async function getDealsForDay(day: DayRef): Promise<ManualDeal[]> {
  const supabase = await createClient();
  const dayStr = formatDayParam(day);
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .eq("deal_date", dayStr)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => normalizeDeal(row as Record<string, unknown>));
}

export async function getUnifiedDealsForDay(day: DayRef): Promise<UnifiedDeal[]> {
  const deals = await getDealsForDay(day);
  return sortUnifiedDeals(deals);
}

export async function getUnifiedDealsForMonth(month: MonthRef): Promise<UnifiedDeal[]> {
  const deals = await getDealsForMonth(month);
  return sortUnifiedDeals(deals);
}

function sortUnifiedDeals(deals: UnifiedDeal[]) {
  const statusRank: Record<UIStatus, number> = {
    approved: 0,
    bought: 1,
    no_deal: 2,
    dealer_didnt_negotiate: 3,
    already_sold: 4,
    bad_spec: 5,
    other: 6,
    follow_up: 7,
    found: 8,
  };

  return deals.sort((a, b) => {
    const dayDelta = b.deal_date.localeCompare(a.deal_date);
    if (dayDelta !== 0) return dayDelta;
    const statusDelta = statusRank[a.ui_status] - statusRank[b.ui_status];
    if (statusDelta !== 0) return statusDelta;
    if (a.scraped_at && b.scraped_at) return b.scraped_at.localeCompare(a.scraped_at);
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function getAllDeals(): Promise<ManualDeal[]> {
  return fetchManualDealsInRange(null, null);
}

export async function getAnalyticsByMake() {
  const deals = await getAllDeals();
  const byMake = new Map<string, { found: number; approved: number; bought: number; totalProfit: number; profits: number[] }>();
  for (const d of deals) {
    const key = d.make || "Unknown";
    const row = byMake.get(key) ?? { found: 0, approved: 0, bought: 0, totalProfit: 0, profits: [] };
    row.found++;
    if (isApprovedStageStatus(d.ui_status)) row.approved++;
    if (d.ui_status === "bought") row.bought++;
    const effectiveProfit = getRealizedDealProfit(d);
    if (effectiveProfit != null) {
      row.totalProfit += effectiveProfit;
      row.profits.push(effectiveProfit);
    }
    byMake.set(key, row);
  }
  return Array.from(byMake.entries()).map(([make, r]) => ({
    make,
    found: r.found,
    approved: r.approved,
    bought: r.bought,
    totalProfit: r.totalProfit,
    avgProfit: r.profits.length ? r.totalProfit / r.profits.length : null,
  })).sort((a, b) => b.totalProfit - a.totalProfit);
}

export async function getAnalyticsByProvince() {
  const deals = await getAllDeals();
  const byProv = new Map<string, { found: number; bought: number; totalProfit: number; profits: number[] }>();
  for (const d of deals) {
    const key = d.province || "—";
    const row = byProv.get(key) ?? { found: 0, bought: 0, totalProfit: 0, profits: [] };
    row.found++;
    if (d.ui_status === "bought") row.bought++;
    const effectiveProfit = getRealizedDealProfit(d);
    if (effectiveProfit != null) {
      row.totalProfit += effectiveProfit;
      row.profits.push(effectiveProfit);
    }
    byProv.set(key, row);
  }
  return Array.from(byProv.entries()).map(([province, r]) => ({
    province,
    found: r.found,
    bought: r.bought,
    totalProfit: r.totalProfit,
    avgProfit: r.profits.length ? r.totalProfit / r.profits.length : null,
  })).sort((a, b) => b.totalProfit - a.totalProfit);
}
