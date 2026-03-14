import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, TrendingUp, Plus, FileText, Settings, Trophy, AlertCircle, LayoutDashboard, Sparkles, DollarSign } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { supabase } from '../lib/supabase'
import { formatTime12h, formatHours } from '../utils/timeUtils'
import { format, addDays } from 'date-fns'
import type { OjtSetup, Profile, PaySetup } from '../types/database'
import { SkeletonCard, SkeletonStatCard } from '../components/ui/Skeleton'

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const { data: totalHours = 0, isLoading: loadingHours } = useQuery({
    queryKey: ['totalHours', userId],
    queryFn: () => SessionService.getTotalHours(userId),
    enabled: !!userId,
  })

  const { data: daysCount = 0 } = useQuery({
    queryKey: ['daysCount', userId],
    queryFn: () => SessionService.getUniqueDaysCount(userId),
    enabled: !!userId,
  })

  const { data: recentResult, isLoading: loadingRecent } = useQuery({
    queryKey: ['recentSessions', userId],
    queryFn: () => SessionService.getSessionsWithBreaks(userId, 5, 0),
    enabled: !!userId,
  })

  const { data: ojtSetup, isLoading: loadingSetup } = useQuery({
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

  const { data: paySetup } = useQuery({
    queryKey: ['paySetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('pay_setup').select('*').eq('user_id', userId).single()
      return data as unknown as PaySetup | null
    },
    enabled: !!userId,
  })

  const recentSessions = recentResult?.data ?? []
  const requiredHours = ojtSetup?.required_hours ?? 0
  const remainingHours = Math.max(0, requiredHours - totalHours)
  const progressPct = requiredHours > 0 ? Math.min(100, (totalHours / requiredHours) * 100) : 0
  const avgHrsPerDay = daysCount > 0 ? totalHours / daysCount : 0

  // Estimated completion date
  const estimatedEndDate = (() => {
    if (!ojtSetup?.start_date || avgHrsPerDay <= 0 || remainingHours <= 0) return null
    const daysNeeded = Math.ceil(remainingHours / avgHrsPerDay)
    return addDays(new Date(), daysNeeded)
  })()

  const displayName = profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student'
  const hasOjtSetup = !loadingSetup && ojtSetup !== null && ojtSetup !== undefined

  const lastUpdated = format(new Date(), 'MMM d, h:mm aa')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* OJT Setup Onboarding Banner */}
      {!loadingSetup && !hasOjtSetup && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: 'var(--accent-light)',
            border: '1px solid var(--accent-border)',
            borderRadius: '0.75rem',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <AlertCircle size={22} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.25rem', fontSize: '1rem' }}>
              Complete your OJT Setup
            </p>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
              Set your required hours, start date, and workplace to unlock progress tracking and estimated completion.
            </p>
          </div>
          <Link
            to="/profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'var(--accent)',
              color: 'white',
              padding: '0.5rem 1.125rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Settings size={15} /> Set Up OJT
          </Link>
        </motion.div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <LayoutDashboard size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Welcome back, {displayName.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Here&apos;s your OJT progress overview.
          </p>
        </div>
      </div>

      {/* Progress Card */}
      {loadingHours ? (
        <SkeletonCard lines={4} />
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--accent-border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '0.625rem',
              backgroundColor: 'var(--accent-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Trophy size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>OJT Progress</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {progressPct >= 100
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sparkles size={13} style={{ color: 'var(--success)' }} /> Goal reached!</span>
                : 'Keep up the great work!'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>
              {progressPct.toFixed(1)}%
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {totalHours.toFixed(1)} of {requiredHours} hours
          </div>

          <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                backgroundColor: progressPct >= 100 ? 'var(--success)' : 'var(--accent)',
                height: '100%',
                borderRadius: '9999px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Completed</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--success)' }}>{formatHours(totalHours)}</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Remaining</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--warning)' }}>{formatHours(remainingHours)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      {loadingHours ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[0,1].map((i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (() => {
          const statCards = [
            { icon: CalendarDays, label: 'Days Attended', value: daysCount.toString(), color: 'var(--accent)' },
            { icon: TrendingUp, label: 'Avg / Day', value: avgHrsPerDay > 0 ? formatHours(avgHrsPerDay) : '—', color: 'var(--accent)' },
            ...(paySetup?.is_enabled ? [{
              icon: DollarSign,
              label: 'Est. Earnings',
              value: formatCurrency(totalHours * paySetup.hourly_rate, paySetup.currency),
              color: 'var(--accent)',
            }] : []),
          ]
          const isOdd = statCards.length % 2 !== 0
          return (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}
        >
          {statCards.map(({ icon: Icon, label, value, color }, idx) => (
            <motion.div
              key={label}
              variants={itemVariants}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                ...(isOdd && idx === statCards.length - 1 ? { gridColumn: 'span 2' } : {}),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
            </motion.div>
          ))}
        </motion.div>
          )
        })()}

      {/* OJT Timeline + Estimated End Date */}
      {hasOjtSetup && ojtSetup && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>OJT Timeline</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(35,165,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start Date</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                  {format(new Date(ojtSetup.start_date + 'T00:00:00'), 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
            {estimatedEndDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    Estimated Completion
                    <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '4px', padding: '0.1rem 0.375rem', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' }}>Estimate</span>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: '0.9375rem' }}>
                    {format(estimatedEndDate, 'MMM dd, yyyy')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Based on {avgHrsPerDay.toFixed(1)}h/day avg (recent work patterns)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[
            { to: '/logs/new', icon: Plus, label: 'Manual Entry', color: 'var(--accent)' },
            { to: '/logs', icon: FileText, label: 'Activity Logs', color: 'var(--accent)' },
            { to: '/reports', icon: TrendingUp, label: 'View Reports', color: 'var(--accent)' },
            { to: '/profile', icon: Settings, label: 'OJT Setup', color: 'var(--accent)' },
          ].map(({ to, icon: Icon, label, color }) => (
            <Link
              key={label}
              to={to}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
                transition: 'background-color 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.backgroundColor = 'var(--bg-hover)'
                el.style.borderColor = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.backgroundColor = 'var(--bg-card)'
                el.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.75rem',
                backgroundColor: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} style={{ color }} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Sessions</h2>
          <Link to="/logs" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>View all</Link>
        </div>

        {loadingRecent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[0,1,2].map((i) => <SkeletonCard key={i} lines={3} />)}
          </div>
        ) : recentSessions.length === 0 ? (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>No sessions logged yet.</p>
            <Link to="/logs/new" style={{ display: 'inline-block', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600 }}>
              Log your first session
            </Link>
          </div>
        ) : (
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {recentSessions.map((session) => (
              <motion.div key={session.id} variants={itemVariants}>
                <Link
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
                  </div>
                  <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    {formatHours(session.total_hours)}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
        Last updated: {lastUpdated}
      </p>
    </motion.div>
  )
}
