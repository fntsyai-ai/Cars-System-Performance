-- UI status for scraper intake rows.
-- Keeps raw scraper listings visible in the app pipeline without removing
-- the separate manual_deals workflow Alex can still use directly.

alter table public.car_listings
  add column if not exists ui_status text;

update public.car_listings
set ui_status = 'found'
where ui_status is null;

alter table public.car_listings
  alter column ui_status set default 'found';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'car_listings_ui_status_check'
  ) then
    alter table public.car_listings
      add constraint car_listings_ui_status_check
      check (ui_status in ('found', 'approved', 'bought', 'no_deal'));
  end if;
end $$;

alter table public.car_listings
  alter column ui_status set not null;

create index if not exists car_listings_ui_status_idx
  on public.car_listings (ui_status);
