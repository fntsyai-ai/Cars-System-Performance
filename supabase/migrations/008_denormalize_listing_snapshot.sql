-- Denormalize scraper listing fields onto manual_deals so the UI never has to
-- query car_listings. Keeps fields in sync via DB triggers in both directions.

alter table public.manual_deals
  add column if not exists title text,
  add column if not exists price numeric(12, 2),
  add column if not exists profit_margin numeric(12, 2),
  add column if not exists dealer_city text,
  add column if not exists url text,
  add column if not exists mmr_link text,
  add column if not exists scraped_at timestamptz,
  add column if not exists telegram_sent text;

-- Backfill from car_listings for every deal that already has a listing_id.
update public.manual_deals md
set
  title = cl.title,
  price = case when cl.price is null then null else cl.price::numeric end,
  profit_margin = case when cl.profit_margin is null then null else cl.profit_margin::numeric end,
  dealer_city = cl.dealer_city,
  url = cl.url,
  mmr_link = cl.mmr_link,
  scraped_at = cl.scraped_at,
  telegram_sent = cl.telegram_sent
from public.car_listings cl
where md.listing_id = cl.id;

-- Rebuild the car_listings → manual_deals sync trigger so it also propagates
-- the denormalized snapshot fields. Status fields (stage/ui_status) stay owned
-- by manual_deals and are never overwritten from car_listings.
create or replace function public.sync_manual_deal_from_car_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.telegram_sent = 'sent' then
    insert into public.manual_deals (
      listing_id,
      deal_date,
      make,
      model,
      province,
      stage,
      ui_status,
      title,
      price,
      profit_margin,
      dealer_city,
      url,
      mmr_link,
      scraped_at,
      telegram_sent
    )
    values (
      new.id,
      (new.scraped_at at time zone 'America/Edmonton')::date,
      coalesce(nullif(new.make, ''), split_part(coalesce(new.title, ''), ' ', 1), 'Unknown'),
      nullif(new.model, ''),
      public.extract_province_code(new.dealer_city),
      'found',
      'found',
      new.title,
      case when new.price is null then null else new.price::numeric end,
      case when new.profit_margin is null then null else new.profit_margin::numeric end,
      new.dealer_city,
      new.url,
      new.mmr_link,
      new.scraped_at,
      new.telegram_sent
    )
    on conflict (listing_id) do update
    set
      deal_date = coalesce(public.manual_deals.deal_date, excluded.deal_date),
      make = coalesce(nullif(public.manual_deals.make, ''), excluded.make),
      model = coalesce(public.manual_deals.model, excluded.model),
      province = coalesce(public.manual_deals.province, excluded.province),
      -- Snapshot fields always follow car_listings (source of truth).
      title = excluded.title,
      price = excluded.price,
      profit_margin = excluded.profit_margin,
      dealer_city = excluded.dealer_city,
      url = excluded.url,
      mmr_link = excluded.mmr_link,
      scraped_at = excluded.scraped_at,
      telegram_sent = excluded.telegram_sent;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_manual_deal_from_car_listing on public.car_listings;

create trigger sync_manual_deal_from_car_listing
after insert or update of
  telegram_sent, make, model, dealer_city, scraped_at, title,
  price, profit_margin, url, mmr_link
on public.car_listings
for each row
execute function public.sync_manual_deal_from_car_listing();

-- Reverse hydration: when a manual_deals row is inserted (or its listing_id
-- changes) with a listing_id, pull any missing snapshot fields from
-- car_listings so the row is self-contained without an app-side join.
create or replace function public.hydrate_manual_deal_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cl record;
begin
  if new.listing_id is null then
    return new;
  end if;

  select
    title,
    case when price is null then null else price::numeric end as price,
    case when profit_margin is null then null else profit_margin::numeric end as profit_margin,
    dealer_city, url, mmr_link, scraped_at, telegram_sent
  into cl
  from public.car_listings
  where id = new.listing_id;

  if not found then
    return new;
  end if;

  new.title := coalesce(new.title, cl.title);
  new.price := coalesce(new.price, cl.price);
  new.profit_margin := coalesce(new.profit_margin, cl.profit_margin);
  new.dealer_city := coalesce(new.dealer_city, cl.dealer_city);
  new.url := coalesce(new.url, cl.url);
  new.mmr_link := coalesce(new.mmr_link, cl.mmr_link);
  new.scraped_at := coalesce(new.scraped_at, cl.scraped_at);
  new.telegram_sent := coalesce(new.telegram_sent, cl.telegram_sent);

  return new;
end;
$$;

drop trigger if exists hydrate_manual_deal_snapshot on public.manual_deals;

create trigger hydrate_manual_deal_snapshot
  before insert or update of listing_id on public.manual_deals
  for each row execute function public.hydrate_manual_deal_snapshot();

-- Helpful indexes for filter/search paths the UI uses.
create index if not exists manual_deals_ui_status_idx
  on public.manual_deals (ui_status);
create index if not exists manual_deals_listing_id_idx
  on public.manual_deals (listing_id);
