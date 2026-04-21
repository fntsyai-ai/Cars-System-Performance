import { getUnifiedDealsForDay } from "@/lib/queries";
import { formatDayParam, formatDayLabel, parseDayParam } from "@/lib/utils";
import { DaySelector } from "@/components/day-selector";
import { ScraperDeals } from "@/components/scraper-deals";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const params = await searchParams;
  const day = parseDayParam(params.d);
  const deals = await getUnifiedDealsForDay(day);
  const linkedDeals = deals.filter((deal) => deal.listing_id != null).length;
  const manualOnlyDeals = deals.length - linkedDeals;

  return (
    <div className="px-4 py-6 md:px-10 md:py-8 max-w-[1600px]">
      <header className="mb-8 md:mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between rise rise-0">
        <div>
          <div className="eyebrow mb-3">Section II · Deal Log</div>
          <h1 className="font-display text-[40px] md:text-[56px] leading-none text-ink-900">
            Deal Log<span className="text-clay-500">.</span>
          </h1>
          <p className="mt-3 text-ink-600 text-[14.5px] max-w-[54ch]">
            Scraper signals and manual entries now live in one shared intake surface. Add fast, edit inline, and keep the ecosystem in sync.
          </p>
        </div>
        <div className="flex items-end justify-between md:justify-end gap-6">
          <div className="text-left md:text-right">
            <div className="eyebrow">Visible</div>
            <div className="font-display text-[36px] md:text-[42px] text-ink-900 tabular leading-none mt-1">
              {deals.length}
            </div>
            <div className="eyebrow mt-2">
              {formatDayLabel(day)}
            </div>
          </div>
          <DaySelector value={day} />
        </div>
      </header>

      <section className="rise rise-1">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-3">Section II-A · Unified Intake</div>
            <h2 className="font-display text-[28px] md:text-[36px] leading-none text-ink-900">
              Deal Signals<span className="text-clay-500">.</span>
            </h2>
            <p className="mt-3 text-ink-600 text-[14.5px] max-w-[64ch]">
              Manual additions sit at the top of the same table as scraper and Telegram deals. `No Deal` rows still stay visible, but fall to the bottom.
            </p>
          </div>
          <div className="text-left md:text-right">
            <div className="eyebrow">Date</div>
            <div className="font-display text-[20px] md:text-[24px] text-ink-900 leading-none mt-1">
              {formatDayParam(day)}
            </div>
            <div className="eyebrow mt-2">
              {linkedDeals} telegram-linked · {manualOnlyDeals} manual
            </div>
          </div>
        </div>
        <ScraperDeals key={formatDayParam(day)} deals={deals} selectedDay={formatDayParam(day)} />
      </section>
    </div>
  );
}
