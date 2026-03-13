import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FileText, Download, Clock, TrendingUp, BarChart3,
  CalendarDays, Printer, Filter,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import SessionService from '../services/sessionService'
import { formatTime12h, formatHours, formatDuration } from '../utils/timeUtils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { Profile, OjtSetup } from '../types/database'
import { DatePicker } from '../components/ui/DatePicker'

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['reportSessions', userId, startDate, endDate],
    queryFn: () => SessionService.getSessionsInRange(userId, startDate, endDate),
    enabled: !!userId && !!startDate && !!endDate,
  })

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      return data as Profile | null
    },
    enabled: !!userId,
  })

  const { data: ojtSetup } = useQuery({
    queryKey: ['ojtSetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('ojt_setup').select('*').eq('user_id', userId).single()
      return data as OjtSetup | null
    },
    enabled: !!userId,
  })

  const totalHours = sessions.reduce((s, sess) => s + sess.total_hours, 0)
  const uniqueDays = new Set(sessions.map((s) => s.date)).size
  const avgHrsPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0
  const totalBreaks = sessions.reduce((s, sess) => s + (sess.breaks?.length ?? 0), 0)

  function exportCSV() {
    const header = 'Date,Time In,Time Out,Duration,Total Hours,Breaks,Journal'
    const rows = sessions.map((s) => {
      const breakCount = s.breaks?.length ?? 0
      const journalSnippet = s.journal ? s.journal.slice(0, 120).replace(/"/g, '""') : ''
      return [
        s.date,
        formatTime12h(s.start_time),
        s.end_time ? formatTime12h(s.end_time) : '',
        formatDuration(s.duration),
        s.total_hours.toFixed(2),
        breakCount,
        `"${journalSnippet}"`,
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ojt-report-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    window.print()
  }

  const statCards = [
    { icon: Clock, label: 'Total Hours', value: formatHours(totalHours), color: 'var(--accent)' },
    { icon: CalendarDays, label: 'Days Attended', value: uniqueDays.toString(), color: 'var(--info)' },
    { icon: TrendingUp, label: 'Avg / Day', value: formatHours(avgHrsPerDay), color: 'var(--success)' },
    { icon: BarChart3, label: 'Sessions', value: sessions.length.toString(), color: 'var(--warning)' },
  ]

  const dateRangeLabel = startDate && endDate
    ? `${format(new Date(startDate + 'T00:00:00'), 'MMM d')} – ${format(new Date(endDate + 'T00:00:00'), 'MMM d, yyyy')}`
    : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* ── Print-only header ── */}
      <div className="print-only print-page">
        <div className="print-header">
          <h1>OJT Progress Report</h1>
          <p>Student: {profile?.full_name ?? user?.email}</p>
          {profile?.school && <p>School: {profile.school}</p>}
          {profile?.workplace && <p>Company: {profile.workplace}</p>}
          {ojtSetup?.required_hours && <p>Required Hours: {ojtSetup.required_hours}h</p>}
          <p>Period: {startDate} to {endDate}</p>
        </div>
        <div className="print-stats">
          <div className="print-stat"><div className="print-stat-value">{formatHours(totalHours)}</div><div className="print-stat-label">Total Hours</div></div>
          <div className="print-stat"><div className="print-stat-value">{uniqueDays}</div><div className="print-stat-label">Days Attended</div></div>
          <div className="print-stat"><div className="print-stat-value">{formatHours(avgHrsPerDay)}</div><div className="print-stat-label">Avg / Day</div></div>
          <div className="print-stat"><div className="print-stat-value">{sessions.length}</div><div className="print-stat-label">Sessions</div></div>
        </div>
      </div>

      {/* ── Page Header ── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Export and analyze your OJT session data
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Filters Section ── */}
      <div className="no-print" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={15} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Filters</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
          </div>
          {dateRangeLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.625rem 0.875rem', backgroundColor: 'var(--accent-light)', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              <CalendarDays size={14} /> {dateRangeLabel}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Statistics ── */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Export Section ── */}
      <div className="no-print" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Download size={15} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Export</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          {/* CSV */}
          <div style={{ backgroundColor: 'var(--bg-modifier)', border: '1px solid var(--border)', borderRadius: '0.625rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'rgba(35,165,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={18} style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>Export CSV</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spreadsheet format</div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
              All sessions with date, time in/out, duration, total hours, break count, and journal snippet.
            </p>
            <button onClick={exportCSV}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'var(--success)', color: 'white', padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
              <Download size={15} /> Download CSV
            </button>
          </div>
          {/* PDF */}
          <div style={{ backgroundColor: 'var(--bg-modifier)', border: '1px solid var(--border)', borderRadius: '0.625rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>Print / PDF</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Print-ready report</div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 0.875rem', lineHeight: 1.5 }}>
              Formatted report with student info, summary stats, and a complete session table for printing or PDF saving.
            </p>
            <button onClick={exportPDF}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
              <Printer size={15} /> Print Report
            </button>
          </div>
        </div>
        {totalBreaks > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', margin: '0.75rem 0 0', textAlign: 'center' }}>
            {sessions.length} sessions · {totalBreaks} total break periods
          </p>
        )}
      </div>

      {/* ── Sessions Table ── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <div className="no-print" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Session Log</h2>
          {dateRangeLabel && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{dateRangeLabel}</span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sessions in this date range.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-modifier)' }}>
                  {['Date', 'Time In', 'Time Out', 'Duration', 'Hours', 'Notes'].map((h) => (
                    <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session, i) => (
                  <tr key={session.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-modifier)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {format(new Date(session.date + 'T00:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatTime12h(session.start_time)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatTime12h(session.end_time)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{formatDuration(session.duration)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        {formatHours(session.total_hours)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.journal ? session.journal.slice(0, 80) : (session.description ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
