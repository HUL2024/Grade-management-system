-- Run this once if you already ran the original schema.sql before this
-- update. It turns on row-level security for settings-type tables that
-- were accidentally left open, and adds matching policies.
-- (If you're running schema.sql fresh, this is already included — skip it.)
-- Safe to run more than once.

alter table assessment_types enable row level security;
alter table grade_scale enable row level security;
alter table school_settings enable row level security;
alter table class_subject_teachers enable row level security;
alter table academic_history enable row level security;
alter table report_card_comments enable row level security;

drop policy if exists "read_assessment_types" on assessment_types;
create policy "read_assessment_types" on assessment_types for select using (auth.role() = 'authenticated');
drop policy if exists "write_assessment_types" on assessment_types;
create policy "write_assessment_types" on assessment_types for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

drop policy if exists "read_grade_scale" on grade_scale;
create policy "read_grade_scale" on grade_scale for select using (auth.role() = 'authenticated');
drop policy if exists "write_grade_scale" on grade_scale;
create policy "write_grade_scale" on grade_scale for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

drop policy if exists "read_school_settings" on school_settings;
create policy "read_school_settings" on school_settings for select using (auth.role() = 'authenticated');
drop policy if exists "write_school_settings" on school_settings;
create policy "write_school_settings" on school_settings for all
  using (current_user_role() = 'administrator')
  with check (current_user_role() = 'administrator');

drop policy if exists "read_class_subject_teachers" on class_subject_teachers;
create policy "read_class_subject_teachers" on class_subject_teachers for select using (auth.role() = 'authenticated');
drop policy if exists "write_class_subject_teachers" on class_subject_teachers;
create policy "write_class_subject_teachers" on class_subject_teachers for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

drop policy if exists "read_academic_history" on academic_history;
create policy "read_academic_history" on academic_history for select using (auth.role() = 'authenticated');
drop policy if exists "write_academic_history" on academic_history;
create policy "write_academic_history" on academic_history for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

drop policy if exists "read_report_card_comments" on report_card_comments;
create policy "read_report_card_comments" on report_card_comments for select using (auth.role() = 'authenticated');
drop policy if exists "write_report_card_comments" on report_card_comments;
create policy "write_report_card_comments" on report_card_comments for all
  using (current_user_role() in ('administrator','principal','teacher','academic_officer'))
  with check (current_user_role() in ('administrator','principal','teacher','academic_officer'));
