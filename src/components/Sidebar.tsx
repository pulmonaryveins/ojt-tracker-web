import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  User,
  LogOut,
  Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/logs', icon: BookOpen, label: 'Logs' },
  { to: '/reports', icon: FileText, label: 'Reports' },
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
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'User'

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
      {/* Logo */}
      <div
        style={{
          padding: '1.25rem 1rem',
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
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
          OJT Tracker
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.5rem 0.5rem' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              marginBottom: '0.125rem',
              fontSize: '0.9375rem',
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

      {/* User section */}
      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
          }}
        >
          {getInitials(displayName)}
        </div>

        <span
          style={{
            flex: 1,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>

        <button
          onClick={handleLogout}
          title="Logout"
          style={{
            color: 'var(--text-muted)',
            padding: '0.25rem',
            borderRadius: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 150ms',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--error)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
