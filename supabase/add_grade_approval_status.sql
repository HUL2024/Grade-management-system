-- Run this once if you already ran supabase/add_period_direct_grades.sql
-- before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)

alter table period_direct_grades add column if not exists status text not null default 'draft'
  check (status in ('draft','submitted','reviewed','finalized','locked'));
