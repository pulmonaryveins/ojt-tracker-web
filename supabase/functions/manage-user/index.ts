import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // ── Verify caller is authenticated ──────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header' }, 401)
    }
    const callerToken = authHeader.slice(7)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    })
    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return json({ error: 'Invalid or expired token' }, 401)
    }

    // ── Verify caller is admin ──────────────────────────────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: profileRow, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('user_id', callerUser.id)
      .maybeSingle()

    if (profileError || profileRow?.role !== 'admin') {
      return json({ error: 'Forbidden: admin only' }, 403)
    }

    // ── Parse request body ──────────────────────────────────────────
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { email, password, full_name, school, year_level, workplace } = body
      if (!email || !password) return json({ error: 'email and password required' }, 400)

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, school, year_level, workplace },
      })
      if (createError) return json({ error: createError.message }, 400)

      await adminClient.from('profiles').upsert({
        user_id: newUser.user.id,
        full_name: full_name ?? '',
        school: school ?? '',
        year_level: year_level ?? '',
        workplace: workplace ?? '',
        profile_picture_url: null,
        role: 'user',
      }, { onConflict: 'user_id' })

      return json({ user_id: newUser.user.id }, 200)
    }

    if (action === 'update') {
      const { user_id, email, full_name, school, year_level, workplace } = body
      if (!user_id) return json({ error: 'user_id required' }, 400)

      // Update auth email if provided
      if (email) {
        const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(user_id, { email })
        if (updateAuthError) return json({ error: updateAuthError.message }, 400)
      }

      // Update profile fields
      const profileUpdates: Record<string, string> = {}
      if (full_name !== undefined) profileUpdates.full_name = full_name
      if (school !== undefined) profileUpdates.school = school
      if (year_level !== undefined) profileUpdates.year_level = year_level
      if (workplace !== undefined) profileUpdates.workplace = workplace

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileUpdateError } = await adminClient
          .from('profiles')
          .update(profileUpdates)
          .eq('user_id', user_id)
        if (profileUpdateError) return json({ error: profileUpdateError.message }, 400)
      }

      return json({ success: true }, 200)
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'user_id required' }, 400)

      // Delete profile first (in case FK constraint exists)
      await adminClient.from('profiles').delete().eq('user_id', user_id)

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id)
      if (deleteError) return json({ error: deleteError.message }, 400)

      return json({ success: true }, 200)
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ error: message }, 500)
  }
})

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
