-- Link manual_deals to scraper listings and keep telegram-sent rows shared.
-- This keeps `car_listings.ui_status` as the source of truth for status changes
-- while `manual_deals` stores the richer deal fields (profit, notes, etc.).

alter table public.manual_deals
  add column if not exists listing_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_deals_listing_id_fkey'
  ) then
    alter table public.manual_deals
      add constraint manual_deals_listing_id_fkey
      foreign key (listing_id) references public.car_listings(id)
      on delete cascade;
  end if;
end $$;

alter table public.manual_deals
  drop constraint if exists manual_deals_stage_check;

alter table public.manual_deals
  add constraint manual_deals_stage_check
  check (stage in ('found', 'approved', 'bought', 'no_deal'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_deals_listing_id_key'
  ) then
    alter table public.manual_deals
      add constraint manual_deals_listing_id_key unique (listing_id);
  end if;
end $$;

create or replace function public.extract_province_code(location text)
returns text
language sql
immutable
as $$
  select case
    when location ~ ',\s*([A-Z]{2})\s*$' then upper((regexp_match(location, ',\s*([A-Z]{2})\s*$'))[1])
    else null
  end
$$;

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
      stage
    )
    values (
      new.id,
      (new.scraped_at at time zone 'America/Edmonton')::date,
      coalesce(nullif(new.make, ''), split_part(coalesce(new.title, ''), ' ', 1), 'Unknown'),
      nullif(new.model, ''),
      public.extract_province_code(new.dealer_city),
      coalesce(nullif(new.ui_status, ''), 'found')
    )
    on conflict (listing_id) do update
    set
      deal_date = coalesce(public.manual_deals.deal_date, excluded.deal_date),
      make = coalesce(nullif(public.manual_deals.make, ''), excluded.make),
      model = coalesce(public.manual_deals.model, excluded.model),
      province = coalesce(public.manual_deals.province, excluded.province),
      stage = excluded.stage;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_manual_deal_from_car_listing on public.car_listings;

create trigger sync_manual_deal_from_car_listing
after insert or update of telegram_sent, ui_status, make, model, dealer_city, scraped_at, title
on public.car_listings
for each row
execute function public.sync_manual_deal_from_car_listing();

insert into public.manual_deals (
  listing_id,
  deal_date,
  make,
  model,
  province,
  stage
)
select
  cl.id,
  (cl.scraped_at at time zone 'America/Edmonton')::date,
  coalesce(nullif(cl.make, ''), split_part(coalesce(cl.title, ''), ' ', 1), 'Unknown'),
  nullif(cl.model, ''),
  public.extract_province_code(cl.dealer_city),
  coalesce(nullif(cl.ui_status, ''), 'found')
from public.car_listings cl
where cl.telegram_sent = 'sent'
on conflict (listing_id) do update
set
  deal_date = coalesce(public.manual_deals.deal_date, excluded.deal_date),
  make = coalesce(nullif(public.manual_deals.make, ''), excluded.make),
  model = coalesce(public.manual_deals.model, excluded.model),
  province = coalesce(public.manual_deals.province, excluded.province),
  stage = excluded.stage;
