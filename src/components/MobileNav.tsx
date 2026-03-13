import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FileText, User, DollarSign } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/logs', icon: BookOpen, label: 'Logs' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function MobileNav() {
  return (
    <nav
      data-mobile-nav
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
          title={label}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem 0',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            textDecoration: 'none',
            transition: 'color 150ms',
            position: 'relative',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={22} />
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '24px',
                    height: '2px',
                    backgroundColor: 'var(--accent)',
                    borderRadius: '0 0 2px 2px',
                  }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
