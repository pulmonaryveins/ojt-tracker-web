import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ChevronLeft, ChevronRight, List, Calendar, Clock, TrendingUp, CalendarDays, FileDown, BookOpen, DollarSign, ChevronDown, X, Coffee } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { supabase } from '../lib/supabase'
import { formatTime12h, formatDuration } from '../utils/timeUtils'
import { SkeletonCard } from '../components/ui/Skeleton'
import type { SessionWithBreaks, PaySetup } from '../types/database'

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

const PAGE_SIZE = 5

type ViewMode = 'list' | 'calendar'

function CalendarView({ userId, paySetup }: { userId: string; paySetup?: PaySetup | null }) {
  const [calendarDate, setCalendarDate] = useState(new Date())
  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth() + 1

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessionsMonth', userId, year, month],
    queryFn: () => SessionService.getSessionsForMonth(userId, year, month),
    enabled: !!userId,
  })

  const sessionsByDate = sessions.reduce<Record<string, Session>>((acc, s) => {
    acc[s.date] = s
    return acc
  }, {})

  const earningsEnabled = paySetup?.is_enabled === true
  const hourlyRate = paySetup?.hourly_rate ?? 0
  const currency = paySetup?.currency ?? 'PHP'

  const monthlyHours = sessions.reduce((sum, s) => sum + (s.total_hours ?? 0), 0)
  const monthlyEarnings = earningsEnabled ? monthlyHours * hourlyRate : 0

  const firstDay = startOfMonth(calendarDate)
  const lastDay = endOfMonth(calendarDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startOffset = getDay(firstDay) // 0=Sun

  const prevMonth = () => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={prevMonth} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
          {format(calendarDate, 'MMMM yyyy')}
        </span>
        <button onClick={nextMonth} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Monthly earnings summary */}
      {earningsEnabled && !isLoading && (
        <div className="earnings-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={15} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {format(calendarDate, 'MMMM yyyy')} Earnings
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="earnings-banner-formula">
              {monthlyHours.toFixed(1)}h × {formatCurrency(hourlyRate, currency)}/hr
            </span>
            <span className="earnings-banner-total">
              {formatCurrency(monthlyEarnings, currency)}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonCard lines={5} />
      ) : (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DAYS_FULL.map((d, i) => (
              <div key={d} style={{ padding: '0.625rem 0.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
                <span className="cal-day-full">{d}</span>
                <span className="cal-day-short">{DAYS_SHORT[i]}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Empty cells before first day */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: earningsEnabled ? '88px' : '72px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
            ))}

            {days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const session = sessionsByDate[dateStr]
              const isCurrentDay = isToday(day)
              const inMonth = isSameMonth(day, calendarDate)
              const colIdx = (startOffset + idx) % 7

              return (
                <div
                  key={dateStr}
                  style={{
                    minHeight: earningsEnabled ? '88px' : '72px',
                    borderRight: colIdx < 6 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: '0.375rem',
                    position: 'relative',
                    opacity: inMonth ? 1 : 0.4,
                    cursor: session ? 'pointer' : 'default',
                    transition: 'background-color 150ms',
                    backgroundColor: isCurrentDay ? 'var(--accent-light)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (session) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = isCurrentDay ? 'var(--accent-light)' : 'transparent'
                  }}
                  onClick={() => session && window.open(`/logs/${session.id}`, '_self')}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isCurrentDay ? 'var(--accent)' : 'transparent',
                    color: isCurrentDay ? 'white' : 'var(--text-secondary)',
                    fontSize: '0.8125rem', fontWeight: isCurrentDay ? 700 : 500,
                    marginBottom: '0.25rem',
                  }}>
                    {format(day, 'd')}
                  </div>
                  {session && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                      <div style={{
                        backgroundColor: 'var(--accent)',
                        borderRadius: '4px',
                        padding: '0.1875rem 0.375rem',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'white',
                        textAlign: 'center',
                      }}>
                        {session.total_hours.toFixed(1)}h
                      </div>
                      {earningsEnabled && (
                        <div style={{
                          backgroundColor: 'rgba(35,165,90,0.15)',
                          borderRadius: '4px',
                          padding: '0.1875rem 0.375rem',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          color: 'var(--success)',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatCurrency(session.total_hours * hourlyRate, currency)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LogsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('') // 'YYYY-MM' or ''
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const filterRef = useRef<HTMLDivElement>(null)

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const { data: paySetup } = useQuery({
    queryKey: ['paySetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('pay_setup').select('*').eq('user_id', userId).single()
      return data as PaySetup | null
    },
    enabled: !!userId,
  })

  const { data: allSessions, isLoading } = useQuery({
    queryKey: ['allSessions', userId],
    queryFn: () => SessionService.getSessionsWithBreaks(userId, 1000, 0),
    enabled: !!userId,
  })

  // All session data
  const allData = allSessions?.data ?? []

  // Derive unique months from sessions for filter options
  const monthOptions = Array.from(
    new Set(allData.map((s) => s.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a))

  // Apply search + month filter
  const filtered = allData.filter((s) => {
    const q = search.trim().toLowerCase()
    const formattedDate = format(new Date(s.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy').toLowerCase()
    const matchSearch = !q ||
      formattedDate.includes(q) ||
      s.date.includes(q) ||
      (s.description?.toLowerCase().includes(q) ?? false)
    const matchMonth = !monthFilter || s.date.startsWith(monthFilter)
    return matchSearch && matchMonth
  })

  // Client-side pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Stats (always from all data)
  const totalHours = allData.reduce((s, x) => s + (x.total_hours ?? 0), 0)
  const totalDays = new Set(allData.map((s) => s.date)).size
  const avgDay = totalDays > 0 ? totalHours / totalDays : 0

  const earningsEnabled = paySetup?.is_enabled === true
  const totalEarnings = earningsEnabled ? totalHours * (paySetup?.hourly_rate ?? 0) : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* Page Header */}
      <div className="page-header">
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BookOpen size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="page-header-text">
          <h1>Logs</h1>
          <p>Track and manage your OJT work history</p>
        </div>
        <div className="page-header-actions">
          <Link
            to="/logs/new"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              backgroundColor: 'var(--accent)', color: 'white',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
            }}
          >
            <Plus size={15} /> <span className="btn-label">New Session</span>
          </Link>
          <Link
            to="/reports"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
            }}
          >
            <FileDown size={15} /> <span className="btn-label">Export</span>
          </Link>
        </div>
      </div>

      {/* Search + filter row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '0.625rem 0.75rem 0.625rem 2.25rem',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
          />
        </div>

        {/* Month filter dropdown */}
        <div ref={filterRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterOpen((o) => !o)}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: monthFilter ? 'var(--accent-light)' : 'var(--bg-card)',
              border: `1px solid ${monthFilter ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '0.5rem',
              color: monthFilter ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              whiteSpace: 'nowrap',
            }}
          >
            <CalendarDays size={15} />
            {monthFilter ? format(new Date(monthFilter + '-01'), 'MMM yyyy') : 'All'}
            {monthFilter
              ? <X size={13} onClick={(e) => { e.stopPropagation(); setMonthFilter(''); setPage(0) }} style={{ marginLeft: '0.125rem' }} />
              : <ChevronDown size={13} />
            }
          </button>
          {filterOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 0.375rem)', zIndex: 50,
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '0.5rem', minWidth: '160px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
              <button
                onClick={() => { setMonthFilter(''); setPage(0); setFilterOpen(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.625rem 1rem',
                  fontSize: '0.875rem', color: !monthFilter ? 'var(--accent)' : 'var(--text-primary)',
                  fontWeight: !monthFilter ? 600 : 400,
                  backgroundColor: !monthFilter ? 'var(--accent-light)' : 'transparent',
                }}
              >
                All months
              </button>
              {monthOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMonthFilter(m); setPage(0); setFilterOpen(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.625rem 1rem',
                    fontSize: '0.875rem', color: monthFilter === m ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: monthFilter === m ? 600 : 400,
                    backgroundColor: monthFilter === m ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  {format(new Date(m + '-01'), 'MMMM yyyy')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.625rem', padding: '0.25rem', gap: '0.25rem' }}>
        {(['list', 'calendar'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
              color: viewMode === mode ? 'white' : 'var(--text-secondary)',
              transition: 'all 150ms',
            }}
          >
            {mode === 'list' ? <List size={15} /> : <Calendar size={15} />}
            {mode === 'list' ? 'List View' : 'Calendar View'}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="logs-stats-grid" style={{ gridTemplateColumns: `repeat(${earningsEnabled ? 4 : 3}, 1fr)` }}>
        {[
          { icon: Clock, label: 'Total Hours', value: totalHours.toFixed(1) + 'h', color: 'var(--accent)' },
          { icon: CalendarDays, label: 'Total Days', value: totalDays.toString(), color: 'var(--accent)' },
          { icon: TrendingUp, label: 'Avg/Day', value: avgDay.toFixed(1) + 'h', color: 'var(--accent)' },
          ...(earningsEnabled ? [{ icon: DollarSign, label: 'Est. Earnings', value: formatCurrency(totalEarnings, paySetup?.currency ?? 'PHP'), color: 'var(--success)' }] : []),
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
              <Icon size={14} style={{ color }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'calendar' ? (
          <motion.div key="calendar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <CalendarView userId={userId} paySetup={paySetup} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                All Sessions
                {(search || monthFilter) && filtered.length > 0 && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    ({filtered.length} result{filtered.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h2>
              <Link to="/logs/new" style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                backgroundColor: 'var(--accent)', color: 'white',
                padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                fontSize: '0.8125rem', fontWeight: 600,
              }}>
                <Plus size={14} /> New
              </Link>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[0,1,2].map((i) => <SkeletonCard key={i} lines={3} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                  {search || monthFilter ? 'No sessions match your search.' : 'No sessions yet.'}
                </p>
                {!search && !monthFilter && (
                  <Link to="/logs/new" style={{ display: 'inline-block', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    Log your first session
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {paginated.map((session) => (
                  <div key={session.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                    <div style={{ flex: 1 }}>
                      <Link
                        to={`/logs/${session.id}`}
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          display: 'block',
                          textDecoration: 'none',
                          transition: 'background-color 150ms',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <CalendarDays size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                                {format(new Date(session.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                              </span>
                              {!session.end_time && (
                                <span style={{ backgroundColor: 'rgba(35,165,90,0.15)', color: 'var(--success)', borderRadius: '9999px', padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 700 }}>
                                  In Progress
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem' }}>
                              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {formatTime12h(session.start_time)} – {formatTime12h(session.end_time)}
                              </span>
                            </div>
                            {session.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {session.description}
                              </div>
                            )}
                            {(session as SessionWithBreaks).breaks?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                                {(session as SessionWithBreaks).breaks.map((brk, i) => (
                                  <span key={brk.id ?? i} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    backgroundColor: 'var(--bg-modifier)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '9999px',
                                    padding: '0.125rem 0.5rem',
                                    fontSize: '0.6875rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500,
                                  }}>
                                    <Coffee size={10} />
                                    {formatTime12h(brk.start_time)} – {formatTime12h(brk.end_time)}
                                    {brk.duration > 0 && <span style={{ opacity: 0.7 }}>· {formatDuration(brk.duration)}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                              {session.total_hours.toFixed(1)}h
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>total hours</div>
                            {(session as SessionWithBreaks).breaks?.length > 0 && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'flex-end' }}>
                                <Coffee size={10} />
                                {(session as SessionWithBreaks).breaks.length} break{(session as SessionWithBreaks).breaks.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.5rem 0.875rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem', fontWeight: 500,
                    opacity: page === 0 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                {/* Page number buttons */}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      style={{
                        width: '34px', height: '34px',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem', fontWeight: page === i ? 700 : 500,
                        backgroundColor: page === i ? 'var(--accent)' : 'var(--bg-card)',
                        color: page === i ? 'white' : 'var(--text-secondary)',
                        border: `1px solid ${page === i ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.5rem 0.875rem',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem', fontWeight: 500,
                    opacity: page >= totalPages - 1 ? 0.5 : 1,
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
