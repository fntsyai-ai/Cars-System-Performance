update public.manual_deals
set
  stage = case when stage = 'follow-up' then 'follow_up' else stage end,
  ui_status = case when ui_status = 'follow-up' then 'follow_up' else ui_status end
where stage = 'follow-up' or ui_status = 'follow-up';

alter table public.manual_deals
  drop constraint if exists manual_deals_stage_check;

alter table public.manual_deals
  drop constraint if exists manual_deals_ui_status_check;

alter table public.manual_deals
  add constraint manual_deals_stage_check
  check (
    stage in (
      'found',
      'follow_up',
      'approved',
      'bought',
      'no_deal',
      'dealer_didnt_negotiate',
      'already_sold',
      'bad_spec',
      'other'
    )
  );

alter table public.manual_deals
  add constraint manual_deals_ui_status_check
  check (
    ui_status in (
      'found',
      'follow_up',
      'approved',
      'bought',
      'no_deal',
      'dealer_didnt_negotiate',
      'already_sold',
      'bad_spec',
      'other'
    )
  );
