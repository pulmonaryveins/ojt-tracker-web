import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FileText, User } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/logs', icon: BookOpen, label: 'Logs' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function MobileNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.625rem 0',
            gap: '0.25rem',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.625rem',
            fontWeight: 500,
            transition: 'color 150ms',
          })}
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
