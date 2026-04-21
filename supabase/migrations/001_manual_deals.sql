-- Manual deal log — Alex's personal pipeline tracking
-- Independent from car_listings so scraper pipeline stays untouched.

create table if not exists public.manual_deals (
  id uuid primary key default gen_random_uuid(),
  deal_date date not null default current_date,
  make text not null,
  model text,
  province text,
  stage text not null default 'found'
    check (stage in ('found', 'approved', 'bought')),
  profit_cad numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_deals_deal_date_idx
  on public.manual_deals (deal_date desc);
create index if not exists manual_deals_stage_idx
  on public.manual_deals (stage);
create index if not exists manual_deals_make_idx
  on public.manual_deals (make);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists manual_deals_set_updated_at on public.manual_deals;
create trigger manual_deals_set_updated_at
  before update on public.manual_deals
  for each row execute function public.set_updated_at();

-- RLS: only authenticated users can touch
alter table public.manual_deals enable row level security;

drop policy if exists "authenticated read" on public.manual_deals;
create policy "authenticated read" on public.manual_deals
  for select to authenticated using (true);

drop policy if exists "authenticated write" on public.manual_deals;
create policy "authenticated write" on public.manual_deals
  for all to authenticated using (true) with check (true);
