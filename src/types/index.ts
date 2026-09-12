export type UserRole = 'administrator' | 'principal' | 'teacher' | 'academic_officer' | 'viewer';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'closed' | 'archived';
}

export interface Period {
  id: string;
  academic_year_id: string;
  name: string;
  sort_order: number;
  is_exam_period: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  academic_year_id: string;
  class_teacher_id: string | null;
}

export interface Teacher {
  id: string;
  teacher_code: string;
  full_name: string;
  gender: 'Male' | 'Female' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  qualification: string | null;
  specialization: string | null;
  employment_date: string | null;
  status: 'Active' | 'Inactive';
  photo_url: string | null;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  max_score: number;
  passing_score: number;
}

export interface Student {
  id: string;
  student_code: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: 'Male' | 'Female' | null;
  photo_url: string | null;
  address: string | null;
  phone: string | null;
  admission_date: string | null;
  current_class_id: string | null;
  section: string | null;
  academic_year_id: string | null;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Withdrawn' | 'Graduated';
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_address: string | null;
  emergency_contact: string | null;
}

export interface AssessmentType {
  id: string;
  name: string;
  category: 'ca' | 'exam';
  max_score: number;
  sort_order: number;
}

export type EntryStatus = 'not_entered' | 'entered' | 'missing' | 'absent' | 'excused' | 'exempt';
export type GradeStatus = 'draft' | 'submitted' | 'reviewed' | 'finalized' | 'locked';

export interface Grade {
  id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  period_id: string;
  assessment_type_id: string;
  score: number | null;
  entry_status: EntryStatus;
  grade_status: GradeStatus;
}

export interface PeriodDirectGrade {
  id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  period_id: string;
  score: number;
  status: GradeStatus;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  date: string;
  status: AttendanceStatus;
}

export interface GradeScaleRow {
  id: string;
  min_score: number;
  max_score: number;
  letter: string;
  description: string | null;
  grade_point: number | null;
  color: string;
}

export interface SchoolSettings {
  id: number;
  school_name: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  ca_weight: number;
  exam_weight: number;
  passing_mark: number;
  tie_rule: string;
  theme_primary: string;
  theme_secondary: string;
}
