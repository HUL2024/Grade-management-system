-- IMPORTANT SECURITY MIGRATION — run this once in the SQL Editor.
-- Restricts teachers to only the classes/subjects they are assigned to
-- (via class_subject_teachers). Administrators/Principals/Academic Officers
-- are unaffected.

alter table periods add column if not exists start_date date;
alter table periods add column if not exists end_date date;

create table if not exists student_conduct (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  conduct text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
alter table student_conduct enable row level security;
drop policy if exists "read_student_conduct" on student_conduct;
create policy "read_student_conduct" on student_conduct for select using (auth.role() = 'authenticated');
drop policy if exists "write_student_conduct" on student_conduct;
create policy "write_student_conduct" on student_conduct for all
  using (current_user_role() in ('administrator','principal','teacher','academic_officer'))
  with check (current_user_role() in ('administrator','principal','teacher','academic_officer'));

create or replace function current_teacher_id() returns uuid
language sql security definer stable as $$
  select id from teachers where user_id = auth.uid();
$$;

-- Students
drop policy if exists "read_all_authenticated" on students;
drop policy if exists "read_students_scoped" on students;
create policy "read_students_scoped" on students for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.class_id = students.current_class_id and cst.teacher_id = current_teacher_id())
);

-- Classes
drop policy if exists "read_all_authenticated" on classes;
drop policy if exists "read_classes_scoped" on classes;
create policy "read_classes_scoped" on classes for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.class_id = classes.id and cst.teacher_id = current_teacher_id())
);

-- Subjects
drop policy if exists "read_all_authenticated" on subjects;
drop policy if exists "read_subjects_scoped" on subjects;
create policy "read_subjects_scoped" on subjects for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.subject_id = subjects.id and cst.teacher_id = current_teacher_id())
);

-- Grades (read + write)
drop policy if exists "read_all_authenticated" on grades;
drop policy if exists "read_grades_scoped" on grades;
create policy "read_grades_scoped" on grades for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id())
);
drop policy if exists "write_grades_staff" on grades;
create policy "write_grades_staff" on grades for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and grades.grade_status in ('draft','submitted') and exists (
      select 1 from class_subject_teachers cst where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  );

-- Direct (Way 2) grades (read + write)
drop policy if exists "read_all_authenticated" on period_direct_grades;
drop policy if exists "read_period_direct_grades_scoped" on period_direct_grades;
create policy "read_period_direct_grades_scoped" on period_direct_grades for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id())
);
drop policy if exists "write_period_direct_grades_staff" on period_direct_grades;
create policy "write_period_direct_grades_staff" on period_direct_grades for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and period_direct_grades.status in ('draft','submitted') and exists (
      select 1 from class_subject_teachers cst where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  );

-- Attendance (read + write)
drop policy if exists "read_all_authenticated" on attendance;
drop policy if exists "read_attendance_scoped" on attendance;
create policy "read_attendance_scoped" on attendance for select using (
  current_user_role() <> 'teacher'
  or exists (select 1 from class_subject_teachers cst where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id())
);
drop policy if exists "write_attendance_staff" on attendance;
create policy "write_attendance_staff" on attendance for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id()
    ))
  );
