import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Clock, CalendarDays, TrendingUp, Target } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { supabase } from '../lib/supabase'
import { formatTime12h, formatHours } from '../utils/timeUtils'
import { format } from 'date-fns'
import type { OjtSetup, Profile } from '../types/database'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const { data: totalHours = 0 } = useQuery({
    queryKey: ['totalHours', userId],
    queryFn: () => SessionService.getTotalHours(userId),
    enabled: !!userId,
  })

  const { data: daysCount = 0 } = useQuery({
    queryKey: ['daysCount', userId],
    queryFn: () => SessionService.getUniqueDaysCount(userId),
    enabled: !!userId,
  })

  const { data: recentResult } = useQuery({
    queryKey: ['recentSessions', userId],
    queryFn: () => SessionService.getSessionsWithBreaks(userId, 5, 0),
    enabled: !!userId,
  })

  const { data: ojtSetup } = useQuery({
    queryKey: ['ojtSetup', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ojt_setup')
        .select('*')
        .eq('user_id', userId)
        .single()
      return data as unknown as OjtSetup | null
    },
    enabled: !!userId,
  })

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      return data as unknown as Profile | null
    },
    enabled: !!userId,
  })

  const recentSessions = recentResult?.data ?? []
  const requiredHours = ojtSetup?.required_hours ?? 0
  const remainingHours = Math.max(0, requiredHours - totalHours)
  const progressPct = requiredHours > 0 ? Math.min(100, (totalHours / requiredHours) * 100) : 0
  const avgHrsPerDay = daysCount > 0 ? totalHours / daysCount : 0

  const displayName = profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Welcome back, {displayName.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Here's your OJT progress overview.
        </p>
      </div>

      {/* Progress Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Overall Progress</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {formatHours(totalHours)} / {requiredHours}h
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
          <div
            style={{
              backgroundColor: progressPct >= 100 ? 'var(--success)' : 'var(--accent)',
              width: `${progressPct}%`,
              height: '100%',
              borderRadius: '9999px',
              transition: 'width 600ms ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {progressPct.toFixed(1)}% complete
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatHours(remainingHours)} remaining
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {[
          { icon: Clock, label: 'Total Hours', value: formatHours(totalHours), color: 'var(--accent)' },
          { icon: Target, label: 'Remaining', value: formatHours(remainingHours), color: 'var(--warning)' },
          { icon: CalendarDays, label: 'Days Attended', value: daysCount.toString(), color: 'var(--success)' },
          { icon: TrendingUp, label: 'Avg / Day', value: formatHours(avgHrsPerDay), color: 'var(--info)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon size={16} style={{ color }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Recent Sessions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Recent Sessions</h2>
          <Link to="/logs" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>View all</Link>
        </div>

        {recentSessions.length === 0 ? (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No sessions yet.</p>
            <Link to="/logs/new" style={{ display: 'inline-block', marginTop: '0.75rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Log your first session
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                to={`/logs/${session.id}`}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '0.875rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textDecoration: 'none',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)' }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {format(new Date(session.date + 'T00:00:00'), 'MMMM d, yyyy')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {formatTime12h(session.start_time)} – {formatTime12h(session.end_time)}
                  </div>
                  {session.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                      {session.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    {formatHours(session.total_hours)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
