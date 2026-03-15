import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Wallet, CalendarDays, Check, Loader2,
  ChevronDown, ChevronUp, X, Banknote, Clock, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import SessionService from '../services/sessionService'
import { formatHours } from '../utils/timeUtils'
import { DatePicker } from '../components/ui/DatePicker'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'
import type { PaySetup } from '../types/database'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function shortAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toFixed(0)
}

// ── Monthly Bar Chart ──────────────────────────────────────────────
function MonthlyChart({
  sessions,
  rate,
}: {
  sessions: Array<{ date: string; total_hours: number }>
  rate: number
}) {
  const currentMonth = format(new Date(), 'yyyy-MM')

  const monthlyData = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) months.push(format(subMonths(new Date(), i), 'yyyy-MM'))
    const map: Record<string, number> = {}
    months.forEach((m) => { map[m] = 0 })
    sessions.forEach((s) => {
      const key = s.date.slice(0, 7)
      if (key in map) map[key] += s.total_hours * rate
    })
    return months.map((m) => ({ month: m, earnings: map[m] }))
  }, [sessions, rate])

  const maxEarnings = Math.max(...monthlyData.map((d) => d.earnings), 1)
  const W = 600
  const H = 180
  const PAD_TOP = 36
  const PAD_BOT = 36
  const PAD_H = 16
  const chartH = H - PAD_TOP - PAD_BOT
  const slotW = (W - PAD_H * 2) / monthlyData.length
  const barW = Math.min(slotW * 0.52, 56)

  const hasAnyData = monthlyData.some((d) => d.earnings > 0)

  if (!hasAnyData) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No earnings data for the last 6 months yet.
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Baseline */}
      <line
        x1={PAD_H} y1={PAD_TOP + chartH}
        x2={W - PAD_H} y2={PAD_TOP + chartH}
        style={{ stroke: 'var(--border)', strokeWidth: 1 }}
      />

      {monthlyData.map((d, i) => {
        const barH = d.earnings > 0 ? Math.max((d.earnings / maxEarnings) * chartH, 6) : 0
        const cx = PAD_H + slotW * i + slotW / 2
        const barY = PAD_TOP + chartH - barH
        const isCurrent = d.month === currentMonth

        return (
          <g key={d.month}>
            {/* Bar */}
            {barH > 0 && (
              <rect
                x={cx - barW / 2} y={barY}
                width={barW} height={barH}
                rx={5}
                style={{ fill: isCurrent ? 'var(--accent)' : 'var(--accent-light)' }}
              />
            )}
            {/* Value label above bar */}
            {d.earnings > 0 && (
              <text
                x={cx} y={barY - 7}
                textAnchor="middle"
                style={{ fontSize: '9.5px', fontFamily: 'inherit', fontWeight: 600, fill: 'var(--text-secondary)' } as React.CSSProperties}
              >
                {shortAmount(d.earnings)}
              </text>
            )}
            {/* Month label */}
            <text
              x={cx} y={H - 8}
              textAnchor="middle"
              style={{
                fontSize: '11px', fontFamily: 'inherit', fontWeight: isCurrent ? 700 : 400,
                fill: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
              } as React.CSSProperties}
            >
              {format(new Date(d.month + '-01T12:00:00'), 'MMM')}
            </text>
            {/* Zero marker for empty months */}
            {d.earnings === 0 && (
              <circle cx={cx} cy={PAD_TOP + chartH} r={2.5} style={{ fill: 'var(--border)' }} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Filter period type ─────────────────────────────────────────────
const EARNINGS_PAGE_SIZE = 5

type FilterPeriod = 'all' | '1m' | '3m' | '6m' | 'ytd'

const FILTER_LABELS: { key: FilterPeriod; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: '1m', label: 'This Month' },
  { key: '3m', label: 'Last 3M' },
  { key: '6m', label: 'Last 6M' },
  { key: 'ytd', label: 'This Year' },
]

// ── Main Page ──────────────────────────────────────────────────────
export default function EarningsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [hourlyRate, setHourlyRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [breakdownPage, setBreakdownPage] = useState(0)

  const handleFilterPeriod = useCallback((p: FilterPeriod) => { setFilterPeriod(p); setBreakdownPage(0) }, [])

  const { data: paySetup, isLoading: loadingPay } = useQuery({
    queryKey: ['paySetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('pay_setup').select('*').eq('user_id', userId).single()
      return data as PaySetup | null
    },
    enabled: !!userId,
  })

  const { data: totalHours = 0 } = useQuery({
    queryKey: ['totalHours', userId],
    queryFn: () => SessionService.getTotalHours(userId),
    enabled: !!userId,
  })

  const { data: sessionsResult } = useQuery({
    queryKey: ['earningsSessions', userId],
    queryFn: () => SessionService.getSessionsWithBreaks(userId, 200, 0),
    enabled: !!userId,
  })

  useEffect(() => {
    if (paySetup) {
      setHourlyRate(paySetup.hourly_rate?.toString() ?? '')
      setEffectiveDate(paySetup.effective_date ?? '')
    }
  }, [paySetup])

  const { mutate: savePay, isPending: savingPay } = useMutation({
    mutationFn: async () => {
      const rate = parseFloat(hourlyRate)
      if (isNaN(rate) || rate <= 0) throw new Error('Please enter a valid hourly rate.')
      const payData = { user_id: userId, is_enabled: true, hourly_rate: rate, currency: 'PHP', effective_date: effectiveDate || null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = paySetup
        ? await supabase.from('pay_setup').update(payData as any).eq('user_id', userId)
        : await supabase.from('pay_setup').insert(payData as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paySetup', userId] })
      setShowSettings(false)
      toast(paySetup ? 'Pay settings updated!' : 'Pay tracking enabled!', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const { mutate: disablePay, isPending: disablingPay } = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('pay_setup').update({ is_enabled: false } as any).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paySetup', userId] })
      setShowSettings(false)
      toast('Pay tracking disabled.', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const sessions = sessionsResult?.data ?? []
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const thisMonthHours = sessions
    .filter((s) => s.date >= monthStart && s.date <= monthEnd)
    .reduce((sum, s) => sum + s.total_hours, 0)

  const isEnabled = !!paySetup?.is_enabled
  const rate = isEnabled ? (paySetup?.hourly_rate ?? 0) : 0
  const curr = 'PHP'
  const totalEarned = totalHours * rate
  const thisMonthEarned = thisMonthHours * rate

  // Filtered sessions for breakdown table
  const filteredSessions = useMemo(() => {
    if (filterPeriod === 'all') return sessions
    let startDate: string
    if (filterPeriod === '1m') startDate = format(startOfMonth(now), 'yyyy-MM-dd')
    else if (filterPeriod === '3m') startDate = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')
    else if (filterPeriod === '6m') startDate = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')
    else startDate = format(startOfYear(now), 'yyyy-MM-dd')
    return sessions.filter((s) => s.date >= startDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, filterPeriod])

  const filteredEarnings = filteredSessions.reduce((sum, s) => sum + s.total_hours * rate, 0)
  const filteredHours = filteredSessions.reduce((sum, s) => sum + s.total_hours, 0)

  const inputBase: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    transition: 'border-color 150ms, box-shadow 150ms',
    fontFamily: 'inherit',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  if (loadingPay) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SkeletonCard lines={5} />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <style>{spinStyle}</style>

      {/* Page Header */}
      <div className="page-header">
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <DollarSign size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="page-header-text">
          <h1>Earnings</h1>
          <p>Track your estimated pay based on logged OJT hours</p>
        </div>
      </div>

      {!isEnabled ? (
        /* ── Setup Card ── */
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '2rem 1.75rem 1.625rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.875rem' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '0.875rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
                Track Your Earnings
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, maxWidth: '340px', lineHeight: 1.65 }}>
                Enter your hourly rate to automatically estimate your earnings from logged OJT hours.
              </p>
            </div>
          </div>

          {/* Feature list */}
          <div style={{ padding: '1.125rem 1.75rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              'Calculated from your existing logged session hours',
              'Monthly breakdown with a visual earnings chart',
              'Turn off anytime — your data stays safe',
            ].map((feat) => (
              <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(35,165,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <Check size={10} style={{ color: 'var(--success)' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{feat}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <div style={{ padding: '1.5rem 1.75rem' }}>
            <form onSubmit={(e) => { e.preventDefault(); savePay() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                  Hourly Rate{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(₱ Philippine Peso)</span>
                </label>
                <div className="input-icon-wrapper">
                  <DollarSign size={15} className="input-icon" />
                  <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 75.00" style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                  Effective Date <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <DatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
              </div>
              <button type="submit" disabled={savingPay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.8125rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', opacity: savingPay ? 0.75 : 1, transition: 'opacity 150ms' }}>
                {savingPay ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enabling…</> : <><Check size={16} /> Enable Pay Tracking</>}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Earnings Dashboard ── */
        <>
          {/* Stat Cards (2 cards) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[
              { label: 'Total Earned', value: formatCurrency(totalEarned, curr), sub: `${formatHours(totalHours)} logged`, icon: DollarSign, accent: true },
              { label: 'This Month', value: formatCurrency(thisMonthEarned, curr), sub: `${formatHours(thisMonthHours)} this month`, icon: CalendarDays, accent: false },
            ].map(({ label, value, sub, icon: Icon, accent }) => (
              <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: accent ? 'var(--accent)' : 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} style={{ color: accent ? 'white' : 'var(--accent)' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Rate Info Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: '0.5rem', padding: '0.625rem 1rem' }}>
            <DollarSign size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Rate: <strong style={{ color: 'var(--accent)' }}>{formatCurrency(rate, curr)}/hr</strong>
              {paySetup?.effective_date && (
                <> · Effective {format(new Date(paySetup.effective_date + 'T00:00:00'), 'MMM d, yyyy')}</>
              )}
            </span>
          </div>

          {/* Monthly Chart */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.125rem' }}>Monthly Earnings</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Last 6 months</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <TrendingUp size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatCurrency(totalEarned, curr)}</span>
                <span>total</span>
              </div>
            </div>
            <div style={{ padding: '1rem 1.25rem 0.75rem' }}>
              <MonthlyChart sessions={sessions} rate={rate} />
            </div>
          </div>

          {/* Session Earnings Breakdown */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            {/* Header with filters */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.125rem' }}>
                    Session Breakdown
                  </h2>
                  {filteredSessions.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} · {formatHours(filteredHours)} · {formatCurrency(filteredEarnings, curr)}
                    </p>
                  )}
                </div>
                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <Filter size={13} style={{ color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.125rem', flexShrink: 0 }} />
                  {FILTER_LABELS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleFilterPeriod(key)}
                      style={{
                        padding: '0.3125rem 0.625rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: filterPeriod === key ? 'var(--accent)' : 'var(--bg-modifier)',
                        color: filterPeriod === key ? 'white' : 'var(--text-secondary)',
                        border: filterPeriod === key ? 'none' : '1px solid var(--border)',
                        transition: 'all 150ms',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Session list */}
            {filteredSessions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {sessions.length === 0
                  ? 'No sessions logged yet. Start logging sessions to see earnings here.'
                  : 'No sessions in this period.'}
              </div>
            ) : (() => {
              const totalPages = Math.ceil(filteredSessions.length / EARNINGS_PAGE_SIZE)
              const paginated = filteredSessions.slice(breakdownPage * EARNINGS_PAGE_SIZE, (breakdownPage + 1) * EARNINGS_PAGE_SIZE)
              return (
                <>
                  <div>
                    {paginated.map((session, i) => {
                      const sessionDate = new Date(session.date + 'T00:00:00')
                      const earned = session.total_hours * rate
                      const journalText = session.journal || session.description || ''
                      return (
                        <div
                          key={session.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '52px 1fr auto',
                            gap: '0.875rem',
                            alignItems: 'start',
                            padding: '0.875rem 1.25rem',
                            borderBottom: i < paginated.length - 1 ? '1px solid var(--border)' : 'none',
                            backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-modifier)',
                            transition: 'background-color 150ms',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? 'transparent' : 'var(--bg-modifier)' }}
                        >
                          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.375rem 0.25rem', textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{format(sessionDate, 'd')}</div>
                            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.125rem', lineHeight: 1 }}>{format(sessionDate, 'MMM')}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1, marginTop: '0.0625rem' }}>{format(sessionDate, 'yyyy')}</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: journalText ? '0.375rem' : 0 }}>
                              <Clock size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatHours(session.total_hours)}</span>
                            </div>
                            {journalText && (
                              <p className="line-clamp-2" title={journalText} style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                {journalText}
                              </p>
                            )}
                          </div>
                          <div style={{ backgroundColor: 'rgba(35,165,90,0.1)', border: '1px solid rgba(35,165,90,0.2)', borderRadius: '0.5rem', padding: '0.375rem 0.625rem', textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatCurrency(earned, curr)}</div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--success)', opacity: 0.7, marginTop: '0.0625rem' }}>earned</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <button onClick={() => setBreakdownPage((p) => Math.max(0, p - 1))} disabled={breakdownPage === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: breakdownPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: breakdownPage === 0 ? 0.5 : 1 }}>
                        <ChevronLeft size={14} /> Prev
                      </button>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {Array.from({ length: totalPages }, (_, i) => (
                          <button key={i} onClick={() => setBreakdownPage(i)}
                            style={{ width: '32px', height: '32px', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: breakdownPage === i ? 700 : 400, backgroundColor: breakdownPage === i ? 'var(--accent)' : 'var(--bg-secondary)', color: breakdownPage === i ? 'white' : 'var(--text-secondary)', border: `1px solid ${breakdownPage === i ? 'var(--accent)' : 'var(--border)'}` }}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setBreakdownPage((p) => Math.min(totalPages - 1, p + 1))} disabled={breakdownPage >= totalPages - 1}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: breakdownPage >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: breakdownPage >= totalPages - 1 ? 0.5 : 1 }}>
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Pay Settings (collapsible) */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: showSettings ? '1px solid var(--border)' : 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Wallet size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pay Settings</span>
              </div>
              {showSettings ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>

            {showSettings && (
              <div style={{ padding: '1.25rem' }}>
                <form onSubmit={(e) => { e.preventDefault(); savePay() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                      Hourly Rate{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(₱ Philippine Peso)</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <DollarSign size={15} className="input-icon" />
                      <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 75.00" style={inputBase} onFocus={onFocus} onBlur={onBlur} required />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                      Effective Date <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                    </label>
                    <DatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="submit" disabled={savingPay} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', opacity: savingPay ? 0.75 : 1, transition: 'opacity 150ms' }}>
                      {savingPay ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Check size={16} /> Save Changes</>}
                    </button>
                    <button type="button" onClick={() => disablePay()} disabled={disablingPay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'rgba(218,55,60,0.1)', color: 'var(--error)', border: '1px solid rgba(218,55,60,0.3)', padding: '0.75rem 1.125rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem', opacity: disablingPay ? 0.75 : 1, transition: 'opacity 150ms' }}>
                      <X size={15} /> Disable
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
