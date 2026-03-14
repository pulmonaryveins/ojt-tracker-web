import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '../components/Sidebar'
import MobileNav from '../components/MobileNav'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { OjtSetup } from '../types/database'

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useAuthStore((s) => s.user?.id ?? '')

  const { data: ojtSetup, isLoading: loadingOjt } = useQuery({
    queryKey: ['ojtSetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('ojt_setup').select('*').eq('user_id', userId).maybeSingle()
      return data as OjtSetup | null
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (!loadingOjt && ojtSetup === null && userId) {
      const skipped = localStorage.getItem(`onboarding_done_${userId}`)
      if (!skipped) {
        navigate('/onboarding', { replace: true })
      }
    }
  }, [loadingOjt, ojtSetup, userId, navigate, location.pathname])

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
        <div
          className="page-content-wrapper"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav — hidden on desktop */}
      <div className="mobile-nav-wrapper">
        <MobileNav />
      </div>

      <style>{`
        .page-content-wrapper {
          padding: 1.25rem 1rem;
        }
        @media (min-width: 640px) {
          .page-content-wrapper { padding: 1.5rem 1.5rem; }
        }
        @media (min-width: 768px) {
          .sidebar-wrapper { display: flex !important; }
          .mobile-nav-wrapper { display: none !important; }
          main { padding-bottom: 0 !important; }
          .page-content-wrapper { padding: 2rem 2rem; }
        }
        @media (min-width: 1024px) {
          .page-content-wrapper { padding: 2rem 3rem; }
        }
        @media (min-width: 1280px) {
          .page-content-wrapper { padding: 2.5rem 4rem; }
        }
        @media (max-width: 767px) {
          .sidebar-wrapper { display: none !important; }
          .mobile-nav-wrapper { display: block !important; }
        }
      `}</style>
    </div>
  )
}
