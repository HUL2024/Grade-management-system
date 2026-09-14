-- Run this once if you already ran schema.sql before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)

alter table attendance add column if not exists period_id uuid references periods(id) on delete set null;

-- Fixes: teachers submitting grades couldn't notify administrators, because
-- the `profiles` table is intentionally locked to "read your own row only" —
-- a teacher's session had no way to look up who the administrators are.
-- This function returns just their user ids, safely, without opening up
-- read access to the whole profiles table.
create or replace function get_approver_user_ids() returns setof uuid
language sql security definer stable as $$
  select id from profiles where role in ('administrator','principal') and is_active = true;
$$;
grant execute on function get_approver_user_ids() to authenticated;
