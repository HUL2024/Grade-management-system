-- Run this once if you already ran schema.sql before this update.
-- (If you're running schema.sql fresh, this is already included — skip it.)

create table if not exists period_direct_grades (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  score numeric not null check (score >= 65 and score <= 100),
  entered_by uuid references profiles(id),
  entered_at timestamptz not null default now(),
  unique (student_id, subject_id, period_id)
);

alter table period_direct_grades enable row level security;

drop policy if exists "read_all_authenticated" on period_direct_grades;
create policy "read_all_authenticated" on period_direct_grades for select using (auth.role() = 'authenticated');

drop policy if exists "write_period_direct_grades_staff" on period_direct_grades;
create policy "write_period_direct_grades_staff" on period_direct_grades for all
  using (current_user_role() in ('administrator','principal','teacher','academic_officer'))
  with check (current_user_role() in ('administrator','principal','teacher','academic_officer'));
