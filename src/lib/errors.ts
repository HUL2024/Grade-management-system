interface DbErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

/**
 * Turns a raw Postgres/Supabase error into a message a non-technical user
 * can actually act on. Falls back to the raw message if we don't recognize
 * the shape of the error, but NEVER silently swallows it — the caller
 * should always show whatever this returns.
 */
export function friendlyDbError(error: DbErrorLike | null | undefined, context?: Record<string, string>): string {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = error.message ?? '';

  if (error.code === '23505' || msg.includes('duplicate key value')) {
    if (msg.includes('student_code')) return 'That Student ID is already used by another student. Please choose a different one.';
    if (msg.includes('admission_number')) return 'That Admission Number is already used by another student. Please choose a different one.';
    if (msg.includes('teacher_code')) return 'That Teacher ID is already used by another teacher. Please choose a different one.';
    if (msg.includes('teachers_phone')) return 'That phone number is already used by another teacher account. Please use a different number.';
    if (msg.includes('subjects_code')) return 'That subject code is already in use. Please choose a different one.';
    if (msg.includes('academic_years_name')) return 'An academic year with that name already exists.';
    if (msg.includes('period_direct_grades') || msg.includes('grades_student_id')) return 'A grade for this student, subject and period already exists.';
    return context?.duplicate ?? 'This would duplicate an existing record — please check the ID/code you entered.';
  }

  if (error.code === '23503' || msg.includes('violates foreign key constraint')) {
    return "This record is linked to other data (e.g. grades or attendance) and can't be changed that way.";
  }

  if (error.code === '23514' || msg.includes('violates check constraint')) {
    return 'One of the values entered is outside the allowed range.';
  }

  if (msg.includes('JWT') || msg.includes('not authenticated')) {
    return 'Your session has expired — please sign in again.';
  }

  if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('policy')) {
    return "You don't have permission to do that.";
  }

  return msg || 'Something went wrong. Please try again.';
}
