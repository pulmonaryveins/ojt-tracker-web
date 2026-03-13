import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  User,
  LogOut,
  Clock,
  DollarSign,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/logs', icon: BookOpen, label: 'Logs' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/profile', icon: User, label: 'Profile' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Sidebar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'User'

  const { data: profile } = useQuery({
    queryKey: ['profile-nav', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, profile_picture_url')
        .eq('user_id', userId)
        .single()
      return data as { full_name: string | null; profile_picture_url: string | null } | null
    },
    enabled: !!userId,
  })

  const profileName = profile?.full_name ?? displayName
  const avatarUrl = profile?.profile_picture_url

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside
      style={{
        width: '240px',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* ── Top Zone: Branding ── */}
      <div
        style={{
          padding: '1.125rem 1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--accent)',
            borderRadius: '0.5rem',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Clock size={18} color="white" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          OJT Tracker
        </span>
      </div>

      {/* ── Middle Zone: Navigation ── */}
      <nav style={{ flex: 1, padding: '0.5rem' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.375rem',
              marginBottom: '0.125rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 150ms',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              if (!el.getAttribute('aria-current')) {
                el.style.backgroundColor = 'var(--bg-hover)'
                el.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              if (!el.getAttribute('aria-current')) {
                el.style.backgroundColor = 'transparent'
                el.style.color = 'var(--text-secondary)'
              }
            }}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom Zone: User + Logout ── */}
      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        {/* User info row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          {/* Avatar */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(profileName)}
          </div>

          <span
            style={{
              flex: 1,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profileName}
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.625rem',
            borderRadius: '0.375rem',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            transition: 'color 150ms, background-color 150ms',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'var(--error)'
            el.style.backgroundColor = 'rgba(242,63,66,0.08)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'var(--text-muted)'
            el.style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  )
}
