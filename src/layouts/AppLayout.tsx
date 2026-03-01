import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileNav from '../components/MobileNav'

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar — hidden on mobile */}
      <div
        style={{
          display: 'flex',
        }}
        className="sidebar-wrapper"
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          paddingBottom: '4rem', // space for mobile nav
        }}
      >
        <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '1.5rem 1rem' }}>
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav — hidden on desktop */}
      <div className="mobile-nav-wrapper">
        <MobileNav />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-wrapper { display: flex !important; }
          .mobile-nav-wrapper { display: none !important; }
          main { padding-bottom: 0 !important; }
        }
        @media (max-width: 767px) {
          .sidebar-wrapper { display: none !important; }
          .mobile-nav-wrapper { display: block !important; }
        }
      `}</style>
    </div>
  )
}
