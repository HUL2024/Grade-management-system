import { supabase } from './supabase';

export async function notifyUsers(userIds: string[], message: string, type: string = 'info') {
  try {
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
    if (uniqueIds.length === 0) return;
    const { error } = await supabase.from('notifications').insert(
      uniqueIds.map((user_id) => ({ user_id, message, type }))
    );
    if (error) console.error('notifyUsers failed:', error.message);
  } catch (err) {
    console.error('notifyUsers threw:', err);
  }
}

/** Notifies every active Administrator/Principal. */
export async function notifyApprovers(message: string, type: string = 'grade_submitted') {
  try {
    // Teachers can't read the profiles table directly (it's locked to "own
    // row only"), so we go through a SECURITY DEFINER function that safely
    // returns just the approver user ids as a named column: { user_id }.
    const { data, error } = await supabase.rpc('get_approver_user_ids');
    if (error) {
      console.error('get_approver_user_ids failed:', error.message);
      return;
    }
    const ids = (data ?? []).map((row: { user_id: string }) => row.user_id).filter(Boolean);
    await notifyUsers(ids, message, type);
  } catch (err) {
    console.error('notifyApprovers threw:', err);
  }
}

/** Notifies the teacher assigned to a given class+subject, if any. */
export async function notifyAssignedTeacher(classId: string, subjectId: string, message: string, type: string = 'grade_status') {
  try {
    const { data: assignment, error: assignErr } = await supabase
      .from('class_subject_teachers')
      .select('teacher_id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (assignErr) { console.error('notifyAssignedTeacher (assignment lookup) failed:', assignErr.message); return; }
    if (!assignment?.teacher_id) return;

    const { data: teacher, error: teacherErr } = await supabase.from('teachers').select('user_id').eq('id', assignment.teacher_id).maybeSingle();
    if (teacherErr) { console.error('notifyAssignedTeacher (teacher lookup) failed:', teacherErr.message); return; }
    if (!teacher?.user_id) return;

    await notifyUsers([teacher.user_id], message, type);
  } catch (err) {
    console.error('notifyAssignedTeacher threw:', err);
  }
}
