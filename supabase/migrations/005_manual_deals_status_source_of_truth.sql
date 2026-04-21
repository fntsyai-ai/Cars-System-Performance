-- manual_deals.ui_status is now the only app-facing status field.
-- Keep creating linked manual_deals rows from telegram-sent listings, but
-- stop mirroring status back to car_listings and remove the old column there.

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
      'found',
      'found'
    )
    on conflict (listing_id) do update
    set
      deal_date = coalesce(public.manual_deals.deal_date, excluded.deal_date),
      make = coalesce(nullif(public.manual_deals.make, ''), excluded.make),
      model = coalesce(public.manual_deals.model, excluded.model),
      province = coalesce(public.manual_deals.province, excluded.province);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_manual_deal_from_car_listing on public.car_listings;

create trigger sync_manual_deal_from_car_listing
after insert or update of telegram_sent, make, model, dealer_city, scraped_at, title
on public.car_listings
for each row
execute function public.sync_manual_deal_from_car_listing();

drop trigger if exists sync_car_listing_status_from_manual_deal on public.manual_deals;
drop function if exists public.sync_car_listing_status_from_manual_deal();

alter table public.car_listings
  drop constraint if exists car_listings_ui_status_check;

alter table public.car_listings
  alter column ui_status drop default;

drop index if exists public.car_listings_ui_status_idx;

alter table public.car_listings
  drop column if exists ui_status;
