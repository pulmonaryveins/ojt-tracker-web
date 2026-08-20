import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Profile } from '../types/database'

export default function AdminRoute() {
  const { session, loading: authLoading, setSession } = useAuthStore()
  const [role, setRole] = useState<'user' | 'admin' | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setSession(null)
      else setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    if (authLoading) return
    if (!session) {
      setLoadingRole(false)
      return
    }
    supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data as Pick<Profile, 'role'> | null)?.role ?? 'user')
        setLoadingRole(false)
      })
  }, [session, authLoading])

  if (authLoading || loadingRole) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div className="spinner" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  return <Outlet />
}
