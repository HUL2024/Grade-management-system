-- ============================================================
-- AJB LEADERS ACADEMY — GRADE MANAGEMENT SYSTEM
-- Supabase / Postgres schema
-- Run this in the Supabase SQL editor on a fresh project.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- USERS / ROLES ----------
-- Supabase auth.users already exists. We extend with a profile + role.
create type user_role as enum ('administrator', 'principal', 'teacher', 'academic_officer', 'viewer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'viewer',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- SCHOOL SETTINGS ----------
create table school_settings (
  id int primary key default 1,
  school_name text not null default 'AJB Leaders Academy',
  motto text,
  address text default 'Diamond Creek, Soul Clinic Community, Paynesville City, Montserrado County, Liberia',
  phone text,
  email text,
  logo_url text,
  ca_weight numeric not null default 40,   -- Continuous Assessment %
  exam_weight numeric not null default 60, -- Final Examination %
  passing_mark numeric not null default 50,
  tie_rule text not null default 'shared_rank', -- shared_rank | next_rank_skip
  theme_primary text not null default '#D4AF37', -- gold
  theme_secondary text not null default '#0A0A0A', -- black
  constraint single_row check (id = 1)
);
insert into school_settings (id) values (1) on conflict do nothing;

-- ---------- ACADEMIC YEARS & PERIODS ----------
create table academic_years (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique, -- e.g. '2026/2027'
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','closed','archived')),
  created_at timestamptz not null default now()
);

create table periods (
  id uuid primary key default uuid_generate_v4(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null, -- e.g. 'First Period', 'Exam 1'
  sort_order int not null default 0,
  is_exam_period boolean not null default false
);

-- ---------- GRADING SCALE ----------
create table grade_scale (
  id uuid primary key default uuid_generate_v4(),
  min_score numeric not null,
  max_score numeric not null,
  letter text not null,
  description text,
  grade_point numeric,
  color text not null default '#22c55e'
);

-- ---------- CLASSES ----------
create table classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null, -- e.g. 'Grade 7', 'KG1'
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  class_teacher_id uuid, -- references teachers(id), added after teachers table
  created_at timestamptz not null default now()
);

-- ---------- TEACHERS ----------
create table teachers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id), -- link to login account, optional
  teacher_code text unique not null,
  full_name text not null,
  gender text check (gender in ('Male','Female')),
  phone text,
  email text,
  address text,
  qualification text,
  specialization text,
  employment_date date,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  photo_url text,
  created_at timestamptz not null default now()
);

alter table classes
  add constraint classes_class_teacher_fk foreign key (class_teacher_id) references teachers(id);

-- ---------- SUBJECTS ----------
create table subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique not null,
  max_score numeric not null default 100,
  passing_score numeric not null default 50,
  created_at timestamptz not null default now()
);

-- class <-> subject <-> teacher assignment
create table class_subject_teachers (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  unique (class_id, subject_id, academic_year_id)
);

-- ---------- STUDENTS ----------
create table students (
  id uuid primary key default uuid_generate_v4(),
  student_code text unique not null,     -- Student ID
  admission_number text unique not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('Male','Female')),
  photo_url text,
  address text,
  phone text,
  admission_date date,
  current_class_id uuid references classes(id),
  section text,
  academic_year_id uuid references academic_years(id),
  status text not null default 'Active' check (status in ('Active','Inactive','Transferred','Withdrawn','Graduated')),
  guardian_name text,
  guardian_relationship text,
  guardian_phone text,
  guardian_address text,
  emergency_contact text,
  created_at timestamptz not null default now()
);

-- ---------- ASSESSMENTS ----------
create table assessment_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null, -- 'Class Participation', 'Homework 1', 'Test', etc.
  category text not null default 'ca' check (category in ('ca','exam')), -- rolls into ca_weight or exam_weight
  max_score numeric not null default 100,
  sort_order int not null default 0
);

-- ---------- GRADES ----------
create table grades (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  assessment_type_id uuid not null references assessment_types(id) on delete cascade,
  score numeric,                 -- null when not entered
  entry_status text not null default 'not_entered'
    check (entry_status in ('not_entered','entered','missing','absent','excused','exempt')),
  grade_status text not null default 'draft'
    check (grade_status in ('draft','submitted','reviewed','finalized','locked')),
  entered_by uuid references profiles(id),
  entered_at timestamptz,
  unique (student_id, subject_id, period_id, assessment_type_id)
);

-- ---------- DIRECT (WAY 2) PERIOD GRADES ----------
-- A teacher may either enter detailed assessment scores (in `grades`, Way 1)
-- or type a final period grade directly here (Way 2). Detailed scores always
-- win: the app blocks a direct entry when detailed scores exist, and clears
-- any direct entry once detailed scores are entered for that student/subject/period.
create table period_direct_grades (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  score numeric not null check (score >= 65 and score <= 100),
  status text not null default 'draft'
    check (status in ('draft','submitted','reviewed','finalized','locked')),
  entered_by uuid references profiles(id),
  entered_at timestamptz not null default now(),
  unique (student_id, subject_id, period_id)
);

-- ---------- PERIODS (date ranges, optional) ----------
alter table periods add column if not exists start_date date;
alter table periods add column if not exists end_date date;

-- ---------- CONDUCT (manually entered, once per student per year) ----------
create table student_conduct (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  conduct text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);

-- ---------- ATTENDANCE ----------
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  period_id uuid references periods(id) on delete set null,
  date date not null,
  status text not null check (status in ('Present','Absent','Late','Excused')),
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ---------- ACADEMIC HISTORY (snapshot, preserved forever) ----------
create table academic_history (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id),
  class_id uuid not null references classes(id),
  average_score numeric,
  overall_position int,
  attendance_percentage numeric,
  promotion_status text check (promotion_status in ('Promoted','Repeated','Graduated','Transferred','Withdrawn')),
  recorded_at timestamptz not null default now()
);

-- ---------- REPORT CARD COMMENTS ----------
create table report_card_comments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  teacher_comment text,
  principal_comment text
);

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- ACTIVITY LOG ----------
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index idx_students_class on students(current_class_id);
create index idx_grades_lookup on grades(student_id, subject_id, period_id);
create index idx_attendance_student_date on attendance(student_id, date);
create index idx_activity_log_created on activity_log(created_at desc);
create unique index idx_teachers_phone_unique on teachers(phone) where phone is not null;

-- ---------- ROW LEVEL SECURITY ----------
alter table profiles enable row level security;
alter table students enable row level security;
alter table teachers enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table grades enable row level security;
alter table attendance enable row level security;
alter table academic_years enable row level security;
alter table periods enable row level security;
alter table period_direct_grades enable row level security;
alter table activity_log enable row level security;
alter table assessment_types enable row level security;
alter table grade_scale enable row level security;
alter table school_settings enable row level security;
alter table class_subject_teachers enable row level security;
alter table academic_history enable row level security;
alter table report_card_comments enable row level security;
alter table student_conduct enable row level security;
alter table notifications enable row level security;

-- Any authenticated, active user can read most academic data (teachers are
-- scoped further below, once current_teacher_id() is defined).
create policy "read_all_authenticated" on teachers for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated" on academic_years for select using (auth.role() = 'authenticated');
create policy "read_all_authenticated" on periods for select using (auth.role() = 'authenticated');
create policy "read_own_profile" on profiles for select using (auth.uid() = id);

-- Writes restricted to administrator/principal/teacher/academic_officer via a helper function.
create or replace function current_user_role() returns user_role
language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

-- Resolves the logged-in teacher's row in `teachers`, if any. Used to scope
-- a teacher's visibility/writes to only the classes and subjects they are
-- actually assigned via class_subject_teachers.
create or replace function current_teacher_id() returns uuid
language sql security definer stable as $$
  select id from teachers where user_id = auth.uid();
$$;

-- Lets ANY authenticated user (e.g. a teacher submitting grades) find who
-- to notify, without granting broad read access to the `profiles` table
-- itself (profiles stays locked to "read your own row only"). Returns a
-- named column (not a bare scalar) so the JSON shape is unambiguous.
create or replace function get_approver_user_ids() returns table(user_id uuid)
language sql security definer stable as $$
  select id from profiles where role in ('administrator','principal') and is_active = true;
$$;
grant execute on function get_approver_user_ids() to authenticated;

-- Students: teachers only see students in classes assigned to them.
create policy "read_students_scoped" on students for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.class_id = students.current_class_id and cst.teacher_id = current_teacher_id()
  )
);

-- Classes: teachers only see classes assigned to them.
create policy "read_classes_scoped" on classes for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.class_id = classes.id and cst.teacher_id = current_teacher_id()
  )
);

-- Subjects: teachers only see subjects assigned to them (in any class).
create policy "read_subjects_scoped" on subjects for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.subject_id = subjects.id and cst.teacher_id = current_teacher_id()
  )
);

-- Grades: teachers only see/touch grades for their assigned class+subject.
create policy "read_grades_scoped" on grades for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id()
  )
);

create policy "read_period_direct_grades_scoped" on period_direct_grades for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id()
  )
);

-- Attendance: teachers only see/mark attendance for their assigned classes
-- (attendance isn't subject-specific, so any assignment to the class qualifies).
create policy "read_attendance_scoped" on attendance for select using (
  current_user_role() <> 'teacher'
  or exists (
    select 1 from class_subject_teachers cst
    where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id()
  )
);

create policy "write_students_staff" on students for all
  using (current_user_role() in ('administrator','principal','academic_officer'))
  with check (current_user_role() in ('administrator','principal','academic_officer'));

create policy "write_grades_staff" on grades for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and grades.grade_status in ('draft','submitted') and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = grades.class_id and cst.subject_id = grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  );

create policy "write_attendance_staff" on attendance for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = attendance.class_id and cst.teacher_id = current_teacher_id()
    ))
  );

create policy "write_period_direct_grades_staff" on period_direct_grades for all
  using (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  )
  with check (
    current_user_role() in ('administrator','principal','academic_officer')
    or (current_user_role() = 'teacher' and period_direct_grades.status in ('draft','submitted') and exists (
      select 1 from class_subject_teachers cst
      where cst.class_id = period_direct_grades.class_id and cst.subject_id = period_direct_grades.subject_id and cst.teacher_id = current_teacher_id()
    ))
  );

create policy "write_admin_only" on academic_years for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "write_admin_only_periods" on periods for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "write_admin_only_teachers" on teachers for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "write_admin_only_classes" on classes for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "write_admin_only_subjects" on subjects for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "log_insert_any" on activity_log for insert with check (auth.role() = 'authenticated');
create policy "log_read_staff" on activity_log for select
  using (current_user_role() in ('administrator','principal'));

create policy "read_assessment_types" on assessment_types for select using (auth.role() = 'authenticated');
create policy "write_assessment_types" on assessment_types for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "read_grade_scale" on grade_scale for select using (auth.role() = 'authenticated');
create policy "write_grade_scale" on grade_scale for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "read_school_settings" on school_settings for select using (auth.role() = 'authenticated');
create policy "write_school_settings" on school_settings for all
  using (current_user_role() = 'administrator')
  with check (current_user_role() = 'administrator');

create policy "read_class_subject_teachers" on class_subject_teachers for select using (auth.role() = 'authenticated');
create policy "write_class_subject_teachers" on class_subject_teachers for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "read_academic_history" on academic_history for select using (auth.role() = 'authenticated');
create policy "write_academic_history" on academic_history for all
  using (current_user_role() in ('administrator','principal'))
  with check (current_user_role() in ('administrator','principal'));

create policy "read_report_card_comments" on report_card_comments for select using (auth.role() = 'authenticated');
create policy "write_report_card_comments" on report_card_comments for all
  using (current_user_role() in ('administrator','principal','teacher','academic_officer'))
  with check (current_user_role() in ('administrator','principal','teacher','academic_officer'));

create policy "read_student_conduct" on student_conduct for select using (auth.role() = 'authenticated');
create policy "write_student_conduct" on student_conduct for all
  using (current_user_role() in ('administrator','principal','teacher','academic_officer'))
  with check (current_user_role() in ('administrator','principal','teacher','academic_officer'));

-- Notifications: everyone can read/update only their own; any authenticated
-- user can create one for someone else (e.g. a teacher notifying admins on
-- submit, or an admin notifying a teacher on approval).
create policy "read_own_notifications" on notifications for select using (user_id = auth.uid());
create policy "update_own_notifications" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "insert_notifications" on notifications for insert with check (auth.role() = 'authenticated');

-- ---------- DEFAULT GRADING SCALE ----------
insert into grade_scale (min_score, max_score, letter, description, grade_point, color) values
  (90, 100, 'A', 'Excellent', 4.0, '#22c55e'),
  (80, 89.99, 'B', 'Very Good', 3.0, '#3b82f6'),
  (70, 79.99, 'C', 'Good', 2.0, '#3b82f6'),
  (60, 69.99, 'D', 'Satisfactory', 1.0, '#ef4444'),
  (50, 59.99, 'E', 'Pass', 0.5, '#ef4444'),
  (0, 49.99, 'F', 'Fail', 0.0, '#ef4444');

-- ---------- SEED DATA (safe to edit/remove) ----------
insert into assessment_types (name, category, max_score, sort_order) values
  ('Class Participation', 'ca', 100, 1),
  ('Homework 1', 'ca', 100, 2),
  ('Homework 2', 'ca', 100, 3),
  ('Quiz 1', 'ca', 100, 4),
  ('Quiz 2', 'ca', 100, 5),
  ('Test', 'exam', 100, 6);

insert into subjects (name, code, max_score, passing_score) values
  ('English Language', 'ENG', 100, 50),
  ('Mathematics', 'MATH', 100, 50),
  ('Science', 'SCI', 100, 50),
  ('Social Studies', 'SOC', 100, 50),
  ('Civic Education', 'CIV', 100, 50),
  ('Religious Education', 'REL', 100, 50),
  ('Computer Studies', 'COMP', 100, 50),
  ('Physical Education', 'PE', 100, 50),
  ('Agriculture', 'AGR', 100, 50),
  ('History', 'HIST', 100, 50),
  ('Geography', 'GEO', 100, 50),
  ('Economics', 'ECON', 100, 50);

-- ---------- PHOTO STORAGE ----------
-- Public bucket for student/teacher photos. Photos are compressed to under
-- 50KB in the app before upload, so this bucket only ever holds small files.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public_read_photos" on storage.objects for select
  using (bucket_id = 'photos');

create policy "staff_upload_photos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));

create policy "staff_update_photos" on storage.objects for update
  using (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));

create policy "staff_delete_photos" on storage.objects for delete
  using (bucket_id = 'photos' and public.current_user_role() in ('administrator','principal','academic_officer'));
