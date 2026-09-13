-- Run this once if you already ran schema.sql before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

drop policy if exists "read_own_notifications" on notifications;
create policy "read_own_notifications" on notifications for select using (user_id = auth.uid());

drop policy if exists "update_own_notifications" on notifications;
create policy "update_own_notifications" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "insert_notifications" on notifications;
create policy "insert_notifications" on notifications for insert with check (auth.role() = 'authenticated');
