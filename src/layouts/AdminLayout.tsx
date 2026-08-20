import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useQuery } from '@tanstack/react-query'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function AdminSidebar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Admin'

  const { data: profile } = useQuery({
    queryKey: ['profile-admin-nav', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, profile_picture_url')
        .eq('user_id', userId)
        .maybeSingle()
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
        width: '224px',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        padding: '0.75rem',
        gap: '0.25rem',
      }}
    >
      {/* Branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.625rem 0.75rem',
          marginBottom: '0.5rem',
        }}
      >
        <img
          src="/icon.png"
          alt="OJT Tracker"
          style={{ width: '30px', height: '30px', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'block' }}>
            OJT Tracker
          </span>
          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Admin
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
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
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Admin badge + user + logout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.5rem' }}>
        {/* Admin badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.75rem',
          borderRadius: '0.375rem',
          backgroundColor: 'var(--accent-light)',
          border: '1px solid var(--accent-border)',
          marginBottom: '0.25rem',
        }}>
          <ShieldCheck size={13} color="var(--accent)" />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Administrator
          </span>
        </div>

        {/* User row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.625rem 0.75rem',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--bg-hover)',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 700, color: 'white',
            flexShrink: 0, overflow: 'hidden',
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(profileName)}
          </div>
          <span style={{
            flex: 1, fontSize: '0.8125rem', fontWeight: 600,
            color: 'var(--text-primary)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {profileName}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
            color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500,
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

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '2rem 2.5rem',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
