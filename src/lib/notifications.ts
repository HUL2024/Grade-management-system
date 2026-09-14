import { supabase } from './supabase';

export async function notifyUsers(userIds: string[], message: string, type: string = 'info') {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0) return;
  await supabase.from('notifications').insert(
    uniqueIds.map((user_id) => ({ user_id, message, type }))
  );
}

/** Notifies every active Administrator/Principal. */
export async function notifyApprovers(message: string, type: string = 'grade_submitted') {
  // Teachers can't read the profiles table directly (it's locked to "own
  // row only"), so we go through a SECURITY DEFINER function that safely
  // returns just the approver user ids.
  const { data } = await supabase.rpc('get_approver_user_ids');
  await notifyUsers((data ?? []) as string[], message, type);
}

/** Notifies the teacher assigned to a given class+subject, if any. */
export async function notifyAssignedTeacher(classId: string, subjectId: string, message: string, type: string = 'grade_status') {
  const { data: assignment } = await supabase
    .from('class_subject_teachers')
    .select('teacher_id')
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  if (!assignment?.teacher_id) return;
  const { data: teacher } = await supabase.from('teachers').select('user_id').eq('id', assignment.teacher_id).maybeSingle();
  if (!teacher?.user_id) return;
  await notifyUsers([teacher.user_id], message, type);
}
