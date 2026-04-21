-- Move the app-facing status onto manual_deals so the UI can read a single table.
-- car_listings.ui_status remains mirrored for scraper pipeline compatibility.

alter table public.manual_deals
  add column if not exists ui_status text;

update public.manual_deals md
set ui_status = coalesce(md.ui_status, md.stage, cl.ui_status, 'found')
from public.car_listings cl
where md.listing_id = cl.id;

update public.manual_deals
set ui_status = coalesce(ui_status, stage, 'found')
where ui_status is null;

alter table public.manual_deals
  alter column ui_status set default 'found';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_deals_ui_status_check'
  ) then
    alter table public.manual_deals
      add constraint manual_deals_ui_status_check
      check (ui_status in ('found', 'approved', 'bought', 'no_deal'));
  end if;
end $$;

alter table public.manual_deals
  alter column ui_status set not null;

create index if not exists manual_deals_ui_status_idx
  on public.manual_deals (ui_status);

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
      ui_status
    )
    values (
      new.id,
      (new.scraped_at at time zone 'America/Edmonton')::date,
      coalesce(nullif(new.make, ''), split_part(coalesce(new.title, ''), ' ', 1), 'Unknown'),
      nullif(new.model, ''),
      public.extract_province_code(new.dealer_city),
      coalesce(nullif(new.ui_status, ''), 'found'),
      coalesce(nullif(new.ui_status, ''), 'found')
    )
    on conflict (listing_id) do update
    set
      deal_date = coalesce(public.manual_deals.deal_date, excluded.deal_date),
      make = coalesce(nullif(public.manual_deals.make, ''), excluded.make),
      model = coalesce(public.manual_deals.model, excluded.model),
      province = coalesce(public.manual_deals.province, excluded.province),
      stage = excluded.stage,
      ui_status = excluded.ui_status;
  end if;

  return new;
end;
$$;

create or replace function public.sync_car_listing_status_from_manual_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.ui_status := coalesce(new.ui_status, new.stage, 'found');
  new.stage := new.ui_status;

  if new.listing_id is not null then
    update public.car_listings
    set ui_status = new.ui_status
    where id = new.listing_id
      and ui_status is distinct from new.ui_status;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_car_listing_status_from_manual_deal on public.manual_deals;

create trigger sync_car_listing_status_from_manual_deal
before insert or update of ui_status, stage, listing_id
on public.manual_deals
for each row
execute function public.sync_car_listing_status_from_manual_deal();
