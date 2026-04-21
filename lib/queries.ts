import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE, formatDayParam, formatMonthParam, formatMonthShortLabel, getMonthDateRange, getMonthUtcRange, getYearStartDate, isApprovedStageStatus, shiftMonth, type DayRef, type MonthRef, type UIStatus } from "@/lib/utils";

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

type DashboardBundle = {
  summary: MonthlySummary;
  trend: { month: string; label: string; profit: number; bought: number; approved: number; found: number }[];
  ytd: number;
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
  if (deal.ui_status !== "bought") return null;
  if (deal.profit_cad != null) return Number(deal.profit_cad);
  if (deal.listing_profit_margin != null) return Number(deal.listing_profit_margin);
  return null;
}

function getMonthKeyInAppTimeZone(isoString: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(isoString));

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

async function getDashboardBundle(month: MonthRef): Promise<DashboardBundle> {
  const supabase = await createClient();
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11));
  const earliestMonth = months[0];
  const monthStart = getMonthDateRange(earliestMonth).start;
  const { start: telegramStart } = getMonthUtcRange(earliestMonth);
  const { end: telegramEnd } = getMonthUtcRange(month);
  const ytdStart = getYearStartDate(month);

  const [manualData, telegramData] = await Promise.all([
    supabase
      .from("manual_deals")
      .select("*")
      .gte("deal_date", monthStart)
      .lte("deal_date", getMonthDateRange(month).end),
    supabase
      .from("car_listings")
      .select("scraped_at")
      .eq("telegram_sent", "sent")
      .gte("scraped_at", telegramStart)
      .lt("scraped_at", telegramEnd),
  ]);

  const manualDeals = await attachListingMetrics(supabase, (manualData.data ?? []) as ManualDeal[]);
  const monthlyTelegramCounts = new Map<string, number>();
  for (const row of (telegramData.data ?? []) as Array<{ scraped_at: string }>) {
    const key = getMonthKeyInAppTimeZone(row.scraped_at);
    monthlyTelegramCounts.set(key, (monthlyTelegramCounts.get(key) ?? 0) + 1);
  }

  const monthlyDeals = new Map<string, DealWithMetrics[]>();
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
    const profits = deals.map(getEffectiveProfit).filter((profit): profit is number => profit != null);

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
  const currentProfits = currentDeals.map(getEffectiveProfit).filter((profit): profit is number => profit != null);
  const approved = currentDeals.filter((deal) => isApprovedStageStatus(deal.ui_status)).length;
  const bought = currentDeals.filter((deal) => deal.ui_status === "bought").length;
  const totalProfit = currentProfits.reduce((sum, profit) => sum + profit, 0);
  const ytd = manualDeals
    .filter((deal) => deal.deal_date >= ytdStart && deal.ui_status === "bought")
    .reduce((sum, deal) => sum + (getEffectiveProfit(deal) ?? 0), 0);

  return {
    summary: {
      month: currentKey,
      telegramFound: monthlyTelegramCounts.get(currentKey) ?? 0,
      dealLogFound: currentDeals.length,
      approved,
      bought,
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
    dealer_didnt_negotiate: 2,
    already_sold: 3,
    bad_spec: 4,
    other: 5,
    found: 6,
    no_deal: 7,
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
    if (isApprovedStageStatus(d.ui_status)) row.approved++;
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
