import { createClient } from "@/lib/supabase/server";
import {
  formatDayParam,
  formatMonthParam,
  formatMonthShortLabel,
  getMonthDateRange,
  getRealizedDealProfit,
  getYearStartDate,
  isApprovedStageStatus,
  isBoughtDealAwaitingPayment,
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

async function getDashboardBundle(month: MonthRef): Promise<DashboardBundle> {
  const supabase = await createClient();
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11));
  const earliestMonth = months[0];
  const monthStart = getMonthDateRange(earliestMonth).start;
  const ytdStart = getYearStartDate(month);

  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .gte("deal_date", monthStart)
    .lte("deal_date", getMonthDateRange(month).end);

  const manualDeals = (data ?? []).map((row) => normalizeDeal(row as Record<string, unknown>));

  const monthlyDeals = new Map<string, ManualDeal[]>();
  for (const deal of manualDeals) {
    const key = deal.deal_date.slice(0, 7);
    const existing = monthlyDeals.get(key);
    if (existing) existing.push(deal);
    else monthlyDeals.set(key, [deal]);
  }

  const trend = months.map((monthRef) => {
    const key = formatMonthParam(monthRef);
    const deals = monthlyDeals.get(key) ?? [];
    const found = deals.length;
    const approved = deals.filter((deal) => isApprovedStageStatus(deal.ui_status)).length;
    const bought = deals.filter((deal) => deal.ui_status === "bought").length;
    const profits = deals.map(getRealizedDealProfit).filter((profit): profit is number => profit != null);

    return {
      month: key,
      label: formatMonthShortLabel(monthRef),
      profit: profits.reduce((sum, profit) => sum + profit, 0),
      bought,
      approved,
      found,
    };
  });

  const currentKey = formatMonthParam(month);
  const currentDeals = monthlyDeals.get(currentKey) ?? [];
  const currentProfits = currentDeals.map(getRealizedDealProfit).filter((profit): profit is number => profit != null);
  const approved = currentDeals.filter((deal) => isApprovedStageStatus(deal.ui_status)).length;
  const boughtDeals = currentDeals.filter((deal) => deal.ui_status === "bought");
  const bought = boughtDeals.length;
  const unpaidBought = boughtDeals.filter(isBoughtDealAwaitingPayment).length;
  const totalProfit = currentProfits.reduce((sum, profit) => sum + profit, 0);
  const ytd = manualDeals
    .filter((deal) => deal.deal_date >= ytdStart && deal.ui_status === "bought")
    .reduce((sum, deal) => sum + (getRealizedDealProfit(deal) ?? 0), 0);

  return {
    summary: {
      month: currentKey,
      // Every manual_deals row originates from a telegram-sent listing, so the
      // row count IS the telegram-found count for the period.
      telegramFound: currentDeals.length,
      dealLogFound: currentDeals.length,
      approved,
      bought,
      unpaidBought,
      realizedBought: currentProfits.length,
      totalProfit,
      avgProfit: currentProfits.length ? totalProfit / currentProfits.length : null,
      foundToApproved: currentDeals.length ? (approved / currentDeals.length) * 100 : null,
      approvedToBought: approved ? (bought / approved) * 100 : null,
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
  const supabase = await createClient();
  const { start, end } = getMonthDateRange(month);
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .gte("deal_date", start)
    .lte("deal_date", end)
    .order("deal_date", { ascending: false });
  return (data ?? []).map((row) => normalizeDeal(row as Record<string, unknown>));
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .order("deal_date", { ascending: false });
  return (data ?? []).map((row) => normalizeDeal(row as Record<string, unknown>));
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
