-- Backfill missing manual_deals.province from car_listings.location when dealer_city is null
-- and improve future syncing to extract province codes from either field.

create or replace function public.extract_province_code(location text)
returns text
language sql
immutable
as $$
  select (regexp_match(upper(coalesce(location, '')), '\m(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\M'))[1]
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
      stage,
      ui_status
    )
    values (
      new.id,
      (new.scraped_at at time zone 'America/Edmonton')::date,
      coalesce(nullif(new.make, ''), split_part(coalesce(new.title, ''), ' ', 1), 'Unknown'),
      nullif(new.model, ''),
      coalesce(
        public.extract_province_code(new.dealer_city),
        public.extract_province_code(new.location)
      ),
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
after insert or update of telegram_sent, make, model, dealer_city, location, scraped_at, title
on public.car_listings
for each row
execute function public.sync_manual_deal_from_car_listing();

update public.manual_deals md
set province = coalesce(
  public.extract_province_code(cl.dealer_city),
  public.extract_province_code(cl.location)
)
from public.car_listings cl
where md.listing_id = cl.id
  and md.province is null
  and coalesce(
    public.extract_province_code(cl.dealer_city),
    public.extract_province_code(cl.location)
  ) is not null;
