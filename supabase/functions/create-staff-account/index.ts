// supabase/functions/create-staff-account/index.ts
//
// Creates a login account for a new staff member (currently: teachers).
// Runs server-side because it needs the SERVICE ROLE key, which must never
// be shipped to the app/browser. The app calls this function; this function
// calls Supabase Auth's admin API.
//
// Deploy with:
//   supabase functions deploy create-staff-account
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//
// (SUPABASE_URL and SUPABASE_ANON_KEY are already provided automatically
// to every Edge Function by Supabase — you only need to set the service
// role key above.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

    // Verify the CALLER is a logged-in administrator or principal.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerUser, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser.user) return json({ error: 'Not authenticated.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.user.id)
      .single();

    if (!callerProfile || !['administrator', 'principal'].includes(callerProfile.role)) {
      return json({ error: 'Only an administrator or principal can create staff accounts.' }, 403);
    }

    const body = await req.json();
    const {
      full_name, phone, password, teacher_code, gender, qualification,
      specialization, employment_date, address, email, status, photo_url,
    } = body;

    if (!full_name || !phone || !password || !teacher_code) {
      return json({ error: 'full_name, phone, password and teacher_code are required.' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    const internalEmail = `${sanitizePhone(phone)}@teacher.ajbleadersacademy.internal`;

    // 1. Create the Auth user (phone number acts as their login, hidden behind an internal email).
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, role: 'teacher' },
    });
    if (createErr || !newUser.user) {
      return json({ error: createErr?.message ?? 'Could not create the login account.' }, 400);
    }

    // 2. Create their profile row.
    const { error: profileErr } = await admin.from('profiles').insert({
      id: newUser.user.id,
      full_name,
      role: 'teacher',
      phone,
      is_active: true,
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: `Could not create profile: ${profileErr.message}` }, 400);
    }

    // 3. Create their teacher record.
    const { data: teacherRow, error: teacherErr } = await admin.from('teachers').insert({
      user_id: newUser.user.id,
      teacher_code,
      full_name,
      gender: gender || null,
      phone,
      email: email || null,
      address: address || null,
      qualification: qualification || null,
      specialization: specialization || null,
      employment_date: employment_date || null,
      status: status || 'Active',
      photo_url: photo_url || null,
    }).select('id').single();
    if (teacherErr) {
      await admin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: `Could not create teacher record: ${teacherErr.message}` }, 400);
    }

    return json({ success: true, user_id: newUser.user.id, teacher_id: teacherRow.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error.' }, 500);
  }
});
