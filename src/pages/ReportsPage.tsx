import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { formatTime12h, formatHours, formatDuration } from '../utils/timeUtils'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const inputStyle = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  padding: '0.625rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
} as const

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

  const totalHours = sessions.reduce((s, sess) => s + sess.total_hours, 0)
  const uniqueDays = new Set(sessions.map((s) => s.date)).size
  const avgHrsPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0

  function exportCSV() {
    const header = 'Date,Time In,Time Out,Duration (min),Total Hours,Breaks,Notes'
    const rows = sessions.map((s) => {
      const breakCount = s.breaks?.length ?? 0
      return [
        s.date,
        formatTime12h(s.start_time),
        formatTime12h(s.end_time),
        s.duration,
        s.total_hours.toFixed(2),
        breakCount,
        `"${(s.description ?? '').replace(/"/g, '""')}"`,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Reports</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Export and review your OJT session data.
        </p>
      </div>

      {/* Date range + export */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Hours', value: formatHours(totalHours) },
          { label: 'Days Attended', value: uniqueDays.toString() },
          { label: 'Avg / Day', value: formatHours(avgHrsPerDay) },
          { label: 'Sessions', value: sessions.length.toString() },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.125rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Sessions</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {format(new Date(startDate + 'T00:00:00'), 'MMM d')} – {format(new Date(endDate + 'T00:00:00'), 'MMM d, yyyy')}
          </span>
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
                      {session.description ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
