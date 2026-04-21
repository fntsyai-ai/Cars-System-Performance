import { createClient } from "@/lib/supabase/server";
import { formatDayParam, formatMonthParam, formatMonthShortLabel, getMonthDateRange, getMonthUtcRange, getYearStartDate, shiftMonth, type DayRef, type MonthRef, type UIStatus } from "@/lib/utils";

export type ManualDeal = {
  id: string;
  listing_id: number | null;
  deal_date: string;
  make: string;
  model: string | null;
  province: string | null;
  stage: UIStatus;
  ui_status: UIStatus;
  profit_cad: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlySummary = {
  month: string; // ISO month string YYYY-MM
  telegramFound: number;
  dealLogFound: number;
  approved: number;
  bought: number;
  totalProfit: number;
  avgProfit: number | null;
  foundToApproved: number | null;
  approvedToBought: number | null;
};

export type ScraperDeal = {
  id: number;
  title: string | null;
  make: string | null;
  model: string | null;
  price: number | null;
  profit_margin: number | null;
  dealer_city: string | null;
  scraped_at: string;
  telegram_sent: string | null;
  url: string | null;
  mmr_link: string | null;
};

export type UnifiedDeal = ManualDeal & {
  listing: ScraperDeal | null;
};

type DealWithMetrics = ManualDeal & {
  listing_profit_margin: number | null;
};

async function attachListingMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  deals: ManualDeal[],
): Promise<DealWithMetrics[]> {
  const listingIds = deals
    .map((deal) => deal.listing_id)
    .filter((id): id is number => typeof id === "number");

  if (!listingIds.length) {
    return deals.map((deal) => ({ ...deal, listing_profit_margin: null }));
  }

  const { data } = await supabase
    .from("car_listings")
    .select("id,profit_margin")
    .in("id", listingIds);

  const marginById = new Map<number, number | null>();
  for (const row of (data ?? []) as Array<{ id: number; profit_margin: number | string | null }>) {
    marginById.set(row.id, row.profit_margin == null ? null : Number(row.profit_margin));
  }

  return deals.map((deal) => ({
    ...deal,
    listing_profit_margin: deal.listing_id != null ? (marginById.get(deal.listing_id) ?? null) : null,
  }));
}

function getEffectiveProfit(deal: DealWithMetrics) {
  if (deal.profit_cad != null) return Number(deal.profit_cad);
  if (deal.ui_status === "bought" && deal.listing_profit_margin != null) return Number(deal.listing_profit_margin);
  return null;
}

export async function getMonthlySummary(month: MonthRef): Promise<MonthlySummary> {
  const supabase = await createClient();
  const { start, end } = getMonthUtcRange(month);
  const { start: startDate, end: endDate } = getMonthDateRange(month);
  const monthStr = formatMonthParam(month);

  // Telegram-found (from car_listings) — count rows where telegram_sent = 'sent'
  const { count: telegramFound } = await supabase
    .from("car_listings")
    .select("*", { count: "exact", head: true })
    .eq("telegram_sent", "sent")
    .gte("scraped_at", start)
    .lt("scraped_at", end);

  // Manual deals this month
  const { data: deals } = await supabase
    .from("manual_deals")
    .select("*")
    .gte("deal_date", startDate)
    .lte("deal_date", endDate);

  const dealsArr = await attachListingMetrics(supabase, (deals ?? []) as ManualDeal[]);
  const dealLogFound = dealsArr.length;
  const approved = dealsArr.filter((d) => d.ui_status === "approved" || d.ui_status === "bought").length;
  const bought = dealsArr.filter((d) => d.ui_status === "bought").length;
  const profits = dealsArr.map(getEffectiveProfit).filter((profit): profit is number => profit != null);
  const totalProfit = profits.reduce((s, p) => s + p, 0);
  const avgProfit = profits.length ? totalProfit / profits.length : null;

  // Treat stages as a pipeline: bought deals have also been found and approved.
  const foundToApproved = dealLogFound ? (approved / dealLogFound) * 100 : null;
  const approvedToBought = approved ? (bought / approved) * 100 : null;

  return {
    month: monthStr,
    telegramFound: telegramFound ?? 0,
    dealLogFound,
    approved,
    bought,
    totalProfit,
    avgProfit,
    foundToApproved,
    approvedToBought,
  };
}

export async function getLast12MonthsTrend(refDate: MonthRef) {
  const out: { month: string; label: string; profit: number; bought: number; approved: number; found: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = shiftMonth(refDate, -i);
    const s = await getMonthlySummary(m);
    out.push({
      month: s.month,
      label: formatMonthShortLabel(m),
      profit: s.totalProfit,
      bought: s.bought,
      approved: s.approved,
      found: s.dealLogFound,
    });
  }
  return out;
}

export async function getYtdProfit(refDate: MonthRef) {
  const supabase = await createClient();
  const startIso = getYearStartDate(refDate);
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .gte("deal_date", startIso)
    .eq("ui_status", "bought");
  const deals = await attachListingMetrics(supabase, (data ?? []) as ManualDeal[]);
  return deals.reduce((sum, deal) => sum + (getEffectiveProfit(deal) ?? 0), 0);
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
  return (data ?? []) as ManualDeal[];
}

export async function getDealsForDay(day: DayRef): Promise<ManualDeal[]> {
  const supabase = await createClient();
  const dayStr = formatDayParam(day);
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .eq("deal_date", dayStr)
    .order("updated_at", { ascending: false });
  return (data ?? []) as ManualDeal[];
}

export async function getUnifiedDealsForDay(day: DayRef): Promise<UnifiedDeal[]> {
  const supabase = await createClient();
  const dayStr = formatDayParam(day);
  const { data: manualData } = await supabase
    .from("manual_deals")
    .select("*")
    .eq("deal_date", dayStr)
    .order("updated_at", { ascending: false });

  const manualDeals = (manualData ?? []) as ManualDeal[];
  const listingIds = manualDeals
    .map((deal) => deal.listing_id)
    .filter((id): id is number => typeof id === "number");

  const listingMap = new Map<number, ScraperDeal>();

  if (listingIds.length) {
    const { data: listingsData } = await supabase
      .from("car_listings")
      .select("id,title,make,model,price,profit_margin,dealer_city,scraped_at,telegram_sent,url,mmr_link")
      .in("id", listingIds);

    for (const listing of (listingsData ?? []) as ScraperDeal[]) {
      listingMap.set(listing.id, listing);
    }
  }

  const statusRank: Record<UIStatus, number> = {
    approved: 0,
    bought: 1,
    found: 2,
    no_deal: 3,
  };

  return manualDeals
    .map((deal) => ({
      ...deal,
      listing: deal.listing_id ? listingMap.get(deal.listing_id) ?? null : null,
    }))
    .sort((a, b) => {
      const statusDelta = statusRank[a.ui_status] - statusRank[b.ui_status];
      if (statusDelta !== 0) return statusDelta;
      if (a.listing?.scraped_at && b.listing?.scraped_at) {
        return b.listing.scraped_at.localeCompare(a.listing.scraped_at);
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
}

export async function getAllDeals(): Promise<ManualDeal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("manual_deals")
    .select("*")
    .order("deal_date", { ascending: false });
  return (data ?? []) as ManualDeal[];
}

export async function getAnalyticsByMake() {
  const supabase = await createClient();
  const deals = await attachListingMetrics(supabase, await getAllDeals());
  const byMake = new Map<string, { found: number; approved: number; bought: number; totalProfit: number; profits: number[] }>();
  for (const d of deals) {
    const key = d.make || "Unknown";
    const row = byMake.get(key) ?? { found: 0, approved: 0, bought: 0, totalProfit: 0, profits: [] };
    row.found++;
    if (d.ui_status === "approved" || d.ui_status === "bought") row.approved++;
    if (d.ui_status === "bought") row.bought++;
    const effectiveProfit = getEffectiveProfit(d);
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
  const supabase = await createClient();
  const deals = await attachListingMetrics(supabase, await getAllDeals());
  const byProv = new Map<string, { found: number; bought: number; totalProfit: number; profits: number[] }>();
  for (const d of deals) {
    const key = d.province || "—";
    const row = byProv.get(key) ?? { found: 0, bought: 0, totalProfit: 0, profits: [] };
    row.found++;
    if (d.ui_status === "bought") row.bought++;
    const effectiveProfit = getEffectiveProfit(d);
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
