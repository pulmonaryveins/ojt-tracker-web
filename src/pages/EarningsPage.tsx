import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Wallet, CalendarDays, Check, Loader2,
  ChevronDown, ChevronUp, X, Banknote, Clock, Filter, ChevronLeft, ChevronRight,
  CalendarRange, Hash, List, Calendar,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import SessionService from '../services/sessionService'
import { formatHours } from '../utils/timeUtils'
import { DatePicker } from '../components/ui/DatePicker'
import Select from '../components/ui/Select'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'
import type { PaySetup } from '../types/database'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths } from 'date-fns'
import { generatePayPeriods, PAY_PERIOD_OPTIONS, type PayPeriod } from '../utils/payPeriodUtils'

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

// ── Pay Periods Calendar ───────────────────────────────────────────
const CAL_DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CAL_DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function PayPeriodsCalendarView({
  sessions,
  rate,
  curr,
  payPeriods,
}: {
  sessions: Array<{ date: string; total_hours: number }>
  rate: number
  curr: string
  payPeriods: PayPeriod[]
}) {
  const [calDate, setCalDate] = useState(new Date())

  const firstDay = startOfMonth(calDate)
  const lastDay = endOfMonth(calDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startOffset = getDay(firstDay)

  // Build earnings map for visible month
  const earningsByDate = useMemo(() => {
    const map: Record<string, number> = {}
    const monthStr = format(calDate, 'yyyy-MM')
    for (const s of sessions) {
      if (s.date.startsWith(monthStr)) {
        map[s.date] = (map[s.date] ?? 0) + s.total_hours * rate
      }
    }
    return map
  }, [sessions, calDate, rate])

  // Which pay period does a date belong to?
  const periodByDate = useMemo(() => {
    const map: Record<string, PayPeriod> = {}
    for (const p of payPeriods) {
      // iterate dates in period
      const start = new Date(p.startDate + 'T00:00:00')
      const end = new Date(p.endDate + 'T00:00:00')
      const pDays = eachDayOfInterval({ start, end })
      for (const d of pDays) {
        map[format(d, 'yyyy-MM-dd')] = p
      }
    }
    return map
  }, [payPeriods])

  const monthlyHours = useMemo(() => {
    const monthStr = format(calDate, 'yyyy-MM')
    return sessions
      .filter((s) => s.date.startsWith(monthStr))
      .reduce((sum, s) => sum + s.total_hours, 0)
  }, [sessions, calDate])

  const monthlyEarnings = monthlyHours * rate

  const prevMonth = () => setCalDate((d) => addMonths(d, -1))
  const nextMonth = () => setCalDate((d) => addMonths(d, 1))

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <button onClick={prevMonth} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
          {format(calDate, 'MMMM yyyy')}
        </span>
        <button onClick={nextMonth} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Monthly earnings summary */}
      {monthlyHours > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1.25rem', backgroundColor: 'rgba(35,165,90,0.06)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {format(calDate, 'MMMM yyyy')} Earnings
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {monthlyHours.toFixed(1)}h × {formatCurrency(rate, curr)}/hr
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)' }}>
              {formatCurrency(monthlyEarnings, curr)}
            </span>
          </div>
        </div>
      )}

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {CAL_DAYS_FULL.map((d, i) => (
          <div key={d} style={{ padding: '0.625rem 0.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
            <span className="cal-day-full">{d}</span>
            <span className="cal-day-short">{CAL_DAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: '80px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
        ))}

        {days.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const earned = earningsByDate[dateStr] ?? 0
          const period = periodByDate[dateStr]
          const isCurrentDay = isToday(day)
          const inMonth = isSameMonth(day, calDate)
          const colIdx = (startOffset + idx) % 7
          const isPeriodStart = period && period.startDate === dateStr
          const isPeriodEnd = period && period.endDate === dateStr
          const isPeriodCurrent = period?.isCurrent

          return (
            <div
              key={dateStr}
              style={{
                minHeight: '80px',
                borderRight: colIdx < 6 ? '1px solid var(--border)' : 'none',
                borderBottom: '1px solid var(--border)',
                padding: '0.375rem',
                position: 'relative',
                opacity: inMonth ? 1 : 0.35,
                backgroundColor: isCurrentDay
                  ? 'var(--accent-light)'
                  : isPeriodCurrent
                  ? 'rgba(35,165,90,0.04)'
                  : 'transparent',
                borderTop: isPeriodStart ? `2px solid ${isPeriodCurrent ? 'var(--accent)' : 'var(--border-strong, var(--border))'}` : undefined,
              }}
            >
              {/* Period number chip on start */}
              {isPeriodStart && period && (
                <div style={{
                  position: 'absolute',
                  top: '0.25rem',
                  right: '0.25rem',
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  backgroundColor: isPeriodCurrent ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: isPeriodCurrent ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${isPeriodCurrent ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  padding: '0.0625rem 0.3125rem',
                  lineHeight: 1.5,
                }}>
                  P{period.periodNumber}
                </div>
              )}

              {/* Day number */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: isCurrentDay ? 'var(--accent)' : 'transparent',
                color: isCurrentDay ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8125rem', fontWeight: isCurrentDay ? 700 : 500,
                marginBottom: '0.25rem',
              }}>
                {format(day, 'd')}
              </div>

              {/* Earnings badge */}
              {earned > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent)',
                    borderRadius: '4px',
                    padding: '0.1875rem 0.375rem',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'white',
                    textAlign: 'center',
                  }}>
                    {(earned / rate).toFixed(1)}h
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(35,165,90,0.15)',
                    borderRadius: '4px',
                    padding: '0.1875rem 0.375rem',
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    color: 'var(--success)',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatCurrency(earned, curr)}
                  </div>
                </div>
              )}

              {/* Period end marker */}
              {isPeriodEnd && !isPeriodStart && (
                <div style={{
                  position: 'absolute',
                  bottom: '0.25rem',
                  right: '0.25rem',
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isPeriodCurrent ? 'var(--accent)' : 'var(--border)',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--accent)' }} />
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Hours logged</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'rgba(35,165,90,0.3)' }} />
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Earnings</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '18px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--text-muted)' }}>P#</span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Period start</span>
        </div>
      </div>
    </div>
  )
}

// ── Pay Period Field ───────────────────────────────────────────────
interface PayPeriodFieldProps {
  payPeriodValue: string
  setPayPeriodValue: (v: string) => void
  customDays: string
  setCustomDays: (v: string) => void
  effectiveDate: string
  resolvedPayPeriodDays: number | null
  inputBase: React.CSSProperties
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void
}

function PayPeriodField({ payPeriodValue, setPayPeriodValue, customDays, setCustomDays, effectiveDate, resolvedPayPeriodDays, inputBase, onFocus, onBlur }: PayPeriodFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
          Pay Period <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <Select
          value={payPeriodValue}
          onChange={(v) => { setPayPeriodValue(v); if (v !== 'custom') setCustomDays('') }}
          placeholder="None (no cutoff)"
          options={PAY_PERIOD_OPTIONS}
          icon={<CalendarRange size={15} />}
        />
      </div>
      {payPeriodValue === 'custom' && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
            Number of Days
          </label>
          <div className="input-icon-wrapper">
            <Hash size={15} className="input-icon" />
            <input
              type="number" min="1" max="365"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="e.g. 14"
              style={inputBase}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
        </div>
      )}
      {resolvedPayPeriodDays && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Periods of <strong>{resolvedPayPeriodDays} days</strong> from{' '}
          {effectiveDate
            ? format(new Date(effectiveDate + 'T00:00:00'), 'MMM d, yyyy')
            : '6 months ago'}
        </p>
      )}
    </div>
  )
}

// ── Pay Period Row ─────────────────────────────────────────────────
function PayPeriodRow({ period, curr, rate }: { period: PayPeriod; curr: string; rate: number }) {
  const start = new Date(period.startDate + 'T00:00:00')
  const end = new Date(period.endDate + 'T00:00:00')
  const sameMonth = format(start, 'MMM yyyy') === format(end, 'MMM yyyy')
  const dateRange = sameMonth
    ? `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
    : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '52px 1fr auto',
      gap: '0.875rem',
      alignItems: 'center',
      padding: '0.875rem 1.25rem',
      borderLeft: `3px solid ${period.isCurrent ? 'var(--accent)' : 'transparent'}`,
      backgroundColor: period.isCurrent ? 'var(--accent-light)' : 'transparent',
      transition: 'background-color 150ms',
    }}>
      {/* Period number badge */}
      <div style={{
        textAlign: 'center',
        backgroundColor: period.isCurrent ? 'var(--accent)' : 'var(--bg-secondary)',
        border: `1px solid ${period.isCurrent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: '0.5rem',
        padding: '0.375rem 0.25rem',
      }}>
        <div style={{ fontSize: '0.625rem', fontWeight: 600, color: period.isCurrent ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Period</div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: period.isCurrent ? 'white' : 'var(--text-primary)', lineHeight: 1 }}>#{period.periodNumber}</div>
      </div>

      {/* Date range + hours */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{dateRange}</span>
          {period.isCurrent && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, backgroundColor: 'var(--accent)', color: 'white', borderRadius: '9999px', padding: '0.125rem 0.5rem', letterSpacing: '0.03em' }}>
              In Progress
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
          {period.hours > 0 ? formatHours(period.hours) : '0h logged'}
          {` · ${rate > 0 ? `${formatCurrency(rate, curr)}/hr` : ''}`}
        </div>
      </div>

      {/* Earnings */}
      <div style={{
        backgroundColor: period.hours > 0 ? 'rgba(35,165,90,0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${period.hours > 0 ? 'rgba(35,165,90,0.2)' : 'var(--border)'}`,
        borderRadius: '0.5rem',
        padding: '0.375rem 0.625rem',
        textAlign: 'center',
        flexShrink: 0,
        minWidth: '80px',
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: period.hours > 0 ? 'var(--success)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {period.hours > 0 ? formatCurrency(period.earnings, curr) : '—'}
        </div>
        <div style={{ fontSize: '0.625rem', color: period.hours > 0 ? 'var(--success)' : 'var(--text-muted)', opacity: 0.7, marginTop: '0.0625rem' }}>
          {period.hours > 0 ? 'earned' : 'no logs'}
        </div>
      </div>
    </div>
  )
}

// ── Filter period type ─────────────────────────────────────────────
const EARNINGS_PAGE_SIZE = 5
const PAY_PERIODS_SHOWN = 6

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
  const [payPeriodValue, setPayPeriodValue] = useState('')
  const [customDays, setCustomDays] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showAllPeriods, setShowAllPeriods] = useState(false)
  const [payPeriodsView, setPayPeriodsView] = useState<'list' | 'calendar'>('list')
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
      const ppd = paySetup.pay_period_days
      if (!ppd) { setPayPeriodValue(''); setCustomDays('') }
      else if ([7, 15, 30].includes(ppd)) { setPayPeriodValue(String(ppd)); setCustomDays('') }
      else { setPayPeriodValue('custom'); setCustomDays(String(ppd)) }
    }
  }, [paySetup])

  const resolvedPayPeriodDays = useMemo((): number | null => {
    if (!payPeriodValue) return null
    if (payPeriodValue === 'custom') {
      const n = parseInt(customDays, 10)
      return n > 0 ? n : null
    }
    return parseInt(payPeriodValue, 10)
  }, [payPeriodValue, customDays])

  const { mutate: savePay, isPending: savingPay } = useMutation({
    mutationFn: async () => {
      const rate = parseFloat(hourlyRate)
      if (isNaN(rate) || rate <= 0) throw new Error('Please enter a valid hourly rate.')
      if (payPeriodValue === 'custom' && !resolvedPayPeriodDays) throw new Error('Enter a valid number of days (minimum 1).')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payData: any = { user_id: userId, is_enabled: true, hourly_rate: rate, currency: 'PHP', effective_date: effectiveDate || null, pay_period_days: resolvedPayPeriodDays }
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

  const payPeriods = useMemo(() => {
    if (!isEnabled || !paySetup?.pay_period_days) return []
    return generatePayPeriods(paySetup.pay_period_days, paySetup.effective_date, sessions, rate)
  }, [isEnabled, paySetup?.pay_period_days, paySetup?.effective_date, sessions, rate])

  const currentPeriod = payPeriods.find((p) => p.isCurrent)
  const displayedPeriods = showAllPeriods ? payPeriods : payPeriods.slice(0, PAY_PERIODS_SHOWN)

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
              <PayPeriodField payPeriodValue={payPeriodValue} setPayPeriodValue={setPayPeriodValue} customDays={customDays} setCustomDays={setCustomDays} effectiveDate={effectiveDate} resolvedPayPeriodDays={resolvedPayPeriodDays} inputBase={inputBase} onFocus={onFocus} onBlur={onBlur} />
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
              { label: 'Total Earned', value: formatCurrency(totalEarned, curr), sub: `${formatHours(totalHours)} logged`, icon: DollarSign },
              { label: 'This Month', value: formatCurrency(thisMonthEarned, curr), sub: `${formatHours(thisMonthHours)} this month`, icon: CalendarDays },
            ].map(({ label, value, sub, icon: Icon }) => (
              <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} style={{ color: 'var(--accent)' }} />
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
              {paySetup?.pay_period_days && (
                <> · Every {paySetup.pay_period_days} days</>
              )}
            </span>
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
                  <PayPeriodField payPeriodValue={payPeriodValue} setPayPeriodValue={setPayPeriodValue} customDays={customDays} setCustomDays={setCustomDays} effectiveDate={effectiveDate} resolvedPayPeriodDays={resolvedPayPeriodDays} inputBase={inputBase} onFocus={onFocus} onBlur={onBlur} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <button type="submit" disabled={savingPay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', opacity: savingPay ? 0.75 : 1, transition: 'opacity 150ms' }}>
                      {savingPay ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Check size={16} /> Save Changes</>}
                    </button>
                    <button type="button" onClick={() => disablePay()} disabled={disablingPay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'rgba(218,55,60,0.1)', color: 'var(--error)', border: '1px solid rgba(218,55,60,0.3)', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.875rem', opacity: disablingPay ? 0.75 : 1, transition: 'opacity 150ms' }}>
                      <X size={15} /> Disable
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Pay Periods Section */}
          {payPeriods.length > 0 && (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.125rem' }}>Pay Periods</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {paySetup?.pay_period_days}-day periods · {payPeriods.length} total
                  </p>
                </div>
                {/* Right: view toggle + current badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  {/* View toggle */}
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.1875rem', gap: '0.1875rem' }}>
                    {(['list', 'calendar'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPayPeriodsView(v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3125rem',
                          padding: '0.3125rem 0.625rem',
                          borderRadius: '0.3125rem',
                          fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: payPeriodsView === v ? 'var(--bg-card)' : 'transparent',
                          color: payPeriodsView === v ? 'var(--accent)' : 'var(--text-muted)',
                          boxShadow: payPeriodsView === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                          transition: 'all 150ms',
                        }}
                      >
                        {v === 'list' ? <List size={13} /> : <Calendar size={13} />}
                        <span className="cal-day-full">{v === 'list' ? 'List' : 'Calendar'}</span>
                      </button>
                    ))}
                  </div>
                  {currentPeriod && (
                    <div style={{ backgroundColor: 'rgba(35,165,90,0.1)', border: '1px solid rgba(35,165,90,0.2)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)' }}>
                        Current: {currentPeriod.hours > 0 ? formatCurrency(currentPeriod.earnings, curr) : '—'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              {payPeriodsView === 'list' ? (
                <>
                  <div>
                    {displayedPeriods.map((period, i) => (
                      <div key={period.periodNumber} style={{ borderBottom: i < displayedPeriods.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <PayPeriodRow period={period} curr={curr} rate={rate} />
                      </div>
                    ))}
                  </div>
                  {payPeriods.length > PAY_PERIODS_SHOWN && (
                    <button
                      type="button"
                      onClick={() => setShowAllPeriods((v) => !v)}
                      style={{ width: '100%', padding: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
                    >
                      {showAllPeriods
                        ? <><ChevronUp size={14} /> Show less</>
                        : <><ChevronDown size={14} /> Show all {payPeriods.length} periods</>}
                    </button>
                  )}
                </>
              ) : (
                <PayPeriodsCalendarView sessions={sessions} rate={rate} curr={curr} payPeriods={payPeriods} />
              )}
            </div>
          )}

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

        </>
      )}
    </motion.div>
  )
}
