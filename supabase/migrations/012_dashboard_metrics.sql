-- Dashboard aggregation pushed into Postgres.
--
-- Previously the app pulled every manual_deals row in a 12-month window into
-- the Node server and aggregated in JS. That tripped Supabase's 1000-row cap
-- (under-counting "Bought" and destabilising YTD) and scanned the whole table
-- three times per page load. This function returns one aggregated row per
-- month so the dashboard transfers ~12 rows instead of thousands.
--
-- The status "funnel" semantics mirror lib/utils.ts exactly:
--   found    = every tracked row for the month
--   approved = reached the approval gate or beyond (anything except found/follow_up)
--   bought   = ui_status = 'bought'
--   realized = a bought deal whose profit_cad is set and non-zero
--              (NULL or 0 means "bought, awaiting payment" and is excluded
--               from profit, matching getRealizedDealProfit / isBoughtDealAwaitingPayment)

create or replace function public.dashboard_monthly_metrics(
  start_month date,
  end_month date
)
returns table (
  month text,
  found integer,
  approved integer,
  bought integer,
  unpaid_bought integer,
  realized_count integer,
  realized_profit numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_char(deal_date, 'YYYY-MM')                                              as month,
    count(*)::integer                                                          as found,
    count(*) filter (where ui_status not in ('found', 'follow_up'))::integer   as approved,
    count(*) filter (where ui_status = 'bought')::integer                      as bought,
    count(*) filter (
      where ui_status = 'bought' and coalesce(profit_cad, 0) = 0
    )::integer                                                                 as unpaid_bought,
    count(*) filter (
      where ui_status = 'bought' and coalesce(profit_cad, 0) <> 0
    )::integer                                                                 as realized_count,
    coalesce(
      sum(profit_cad) filter (
        where ui_status = 'bought' and coalesce(profit_cad, 0) <> 0
      ),
      0
    )                                                                          as realized_profit
  from public.manual_deals
  where deal_date >= start_month
    and deal_date <= end_month
  group by to_char(deal_date, 'YYYY-MM');
$$;

-- RLS still applies (security invoker); authenticated users may call it.
grant execute on function public.dashboard_monthly_metrics(date, date) to authenticated;
