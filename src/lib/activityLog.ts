import { supabase } from './supabase';

export async function logActivity(action: string, details?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({
    user_id: data.user?.id ?? null,
    action,
    details: details ?? {},
  });
}
