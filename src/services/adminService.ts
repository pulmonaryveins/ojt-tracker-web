import { supabase } from '../lib/supabase'
import type { AdminUserSummary, Profile } from '../types/database'

export interface AdminUserRow extends Profile {
  email: string
}

export interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  school: string
  year_level: string
  workplace: string
}

export interface UpdateUserPayload {
  email?: string
  full_name?: string
  school?: string
  year_level?: string
  workplace?: string
}

async function callManageUser(body: Record<string, unknown>): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  )

  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? `Request failed: ${res.status}`)
  return json
}

const AdminService = {
  /** Aggregated progress + earnings per user (calls DB RPC) */
  async getUserSummaries(): Promise<AdminUserSummary[]> {
    const { data, error } = await supabase.rpc('get_admin_user_summary')
    if (error) throw error
    return (data ?? []) as AdminUserSummary[]
  },

  /** All user profiles + emails (calls DB RPC) */
  async getAllUsers(): Promise<AdminUserRow[]> {
    const { data, error } = await supabase.rpc('get_admin_all_users')
    if (error) throw error
    return (data ?? []) as AdminUserRow[]
  },

  /** Create a new auth user + profile via Edge Function */
  async createUser(payload: CreateUserPayload): Promise<void> {
    await callManageUser({ action: 'create', ...payload })
  },

  /** Update an existing auth user + profile via Edge Function */
  async updateUser(userId: string, payload: UpdateUserPayload): Promise<void> {
    await callManageUser({ action: 'update', user_id: userId, ...payload })
  },

  /** Delete an auth user + profile via Edge Function */
  async deleteUser(userId: string): Promise<void> {
    await callManageUser({ action: 'delete', user_id: userId })
  },
}

export default AdminService
