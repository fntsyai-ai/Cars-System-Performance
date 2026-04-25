-- Snapshot VIN onto manual_deals so the dashboard can display and search it
-- without querying car_listings directly.

alter table public.manual_deals
  add column if not exists vin varchar(17);

update public.manual_deals md
set vin = cl.vin
from public.car_listings cl
where md.listing_id = cl.id;

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
      vin,
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
      new.vin,
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
      vin = excluded.vin,
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
  telegram_sent, vin, make, model, dealer_city, scraped_at, title,
  price, profit_margin, url, mmr_link
on public.car_listings
for each row
execute function public.sync_manual_deal_from_car_listing();

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
    vin,
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

  new.vin := coalesce(new.vin, cl.vin);
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

create index if not exists manual_deals_vin_idx
  on public.manual_deals (vin);
