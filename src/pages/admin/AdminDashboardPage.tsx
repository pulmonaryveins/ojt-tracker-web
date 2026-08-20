import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Clock, TrendingUp, DollarSign, CalendarDays, ShieldCheck } from 'lucide-react'
import AdminService from '../../services/adminService'
import { SkeletonStatCard, SkeletonCard } from '../../components/ui/Skeleton'
import type { AdminUserSummary } from '../../types/database'

function formatHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 30 ? 'var(--warning)' : 'var(--error)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-modifier)', borderRadius: '999px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', backgroundColor: color, borderRadius: '999px' }}
        />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color, minWidth: '36px', textAlign: 'right' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.25rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
}

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }

export default function AdminDashboardPage() {
  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['admin-user-summaries'],
    queryFn: () => AdminService.getUserSummaries(),
  })

  const totalUsers = summaries.length
  const totalHoursAll = summaries.reduce((s, u) => s + u.total_hours, 0)
  const avgCompletion = totalUsers === 0 ? 0
    : summaries.reduce((s, u) => s + (u.required_hours ? Math.min((u.total_hours / u.required_hours) * 100, 100) : 0), 0) / totalUsers
  const totalEarnings = summaries.reduce((s, u) => s + (u.hourly_rate ?? 0) * u.total_hours, 0)

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: '1.75rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
          <ShieldCheck size={20} color="var(--accent)" />
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Admin Dashboard
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          Overview of all OJT trainees, hours logged, and earnings.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : (
            <>
              {[
                { icon: Users, label: 'Total Trainees', value: String(totalUsers), color: 'var(--accent)' },
                { icon: Clock, label: 'Total Hours Logged', value: formatHours(totalHoursAll), color: 'var(--info)' },
                { icon: TrendingUp, label: 'Avg. Completion', value: `${avgCompletion.toFixed(1)}%`, color: 'var(--success)' },
                { icon: DollarSign, label: 'Combined Earnings', value: totalEarnings > 0 ? `$${totalEarnings.toFixed(0)}` : '—', color: 'var(--warning)' },
              ].map(({ icon: Icon, label, value, color }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={cardStyle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={15} color={color} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {label}
                    </span>
                  </div>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {value}
                  </span>
                </motion.div>
              ))}
            </>
          )}
      </div>

      {/* Users table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}
      >
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Trainee Progress
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {totalUsers} {totalUsers === 1 ? 'user' : 'users'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : summaries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No trainees yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Trainee', 'School', 'Workplace', 'Progress', 'Hours', 'Earnings', 'Last Session', 'Days'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '0.625rem 1rem',
                        textAlign: 'left',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="hidden" animate="visible">
                {summaries.map((u: AdminUserSummary) => {
                  const earnings = (u.hourly_rate ?? 0) * u.total_hours
                  return (
                    <motion.tr
                      key={u.user_id}
                      variants={itemVariants}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                    >
                      {/* Trainee */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.625rem', fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden',
                          }}>
                            {u.profile_picture_url
                              ? <img src={u.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : u.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* School */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {u.school || '—'}
                      </td>

                      {/* Workplace */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {u.workplace || '—'}
                      </td>

                      {/* Progress */}
                      <td style={{ padding: '0.75rem 1rem', minWidth: '160px' }}>
                        {u.required_hours
                          ? <ProgressBar value={u.total_hours} max={u.required_hours} />
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No target set</span>}
                      </td>

                      {/* Hours */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <span>{formatHours(u.total_hours)}</span>
                        {u.required_hours && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {formatHours(u.required_hours)}</span>
                        )}
                      </td>

                      {/* Earnings */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {u.hourly_rate && u.currency ? formatCurrency(earnings, u.currency) : '—'}
                      </td>

                      {/* Last session */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <CalendarDays size={13} color="var(--text-muted)" />
                          {u.last_session_date ?? '—'}
                        </div>
                      </td>

                      {/* Days */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {u.days_count}
                      </td>
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
