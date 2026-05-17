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
