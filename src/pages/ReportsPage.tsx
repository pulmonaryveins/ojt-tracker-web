import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FileText, Download, Clock, TrendingUp, BarChart3,
  CalendarDays, Filter, FileDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import SessionService from '../services/sessionService'
import { formatTime12h, formatHours, formatDuration } from '../utils/timeUtils'
import { format, startOfMonth, endOfMonth, getDay } from 'date-fns'
import type { Profile, OjtSetup, SessionWithBreaks } from '../types/database'
import { DatePicker } from '../components/ui/DatePicker'

// ── SVG Chart Components ─────────────────────────────────────────

function DailyHoursChart({ sessions }: { sessions: SessionWithBreaks[] }) {
  const byDate: Record<string, number> = {}
  sessions.forEach((s) => { byDate[s.date] = (byDate[s.date] ?? 0) + s.total_hours })
  const entries = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))

  if (!entries.length) {
    return (
      <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No sessions in this range
      </div>
    )
  }

  const N = entries.length
  const maxH = Math.max(...entries.map(([, v]) => v), 0.1)
  const W = 560, CH = 130, PL = 44, PR = 12, PT = 16, PB = 46
  const areaW = W - PL - PR
  const barW = Math.max(5, Math.min(36, areaW / N - 3))
  const step = areaW / N
  const gridPcts = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${W} ${PT + CH + PB}`} style={{ width: '100%', display: 'block', color: 'var(--text-primary)' }}>
      {/* Zero line */}
      <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      {/* Grid */}
      {gridPcts.map((pct) => {
        const y = PT + CH * (1 - pct)
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.07} strokeWidth={0.5} />
            <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.45}>
              {(maxH * pct).toFixed(1)}
            </text>
          </g>
        )
      })}
      {/* Bars */}
      {entries.map(([date, hours], i) => {
        const barH = Math.max(0, (hours / maxH) * CH)
        const cx = PL + i * step + step / 2
        const x = cx - barW / 2
        const y = PT + CH - barH
        const label = N <= 18
          ? format(new Date(date + 'T00:00:00'), 'MM/dd')
          : format(new Date(date + 'T00:00:00'), 'M/d')
        return (
          <g key={date}>
            <rect x={x} y={y} width={barW} height={barH} fill="var(--accent)" rx={2} opacity={0.85} />
            {barW >= 20 && hours > 0 && (
              <text x={cx} y={y - 4} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.55}>
                {hours.toFixed(1)}
              </text>
            )}
            <text
              x={0} y={0}
              fontSize={8.5} fill="currentColor" opacity={0.5}
              transform={`translate(${cx},${PT + CH + 8}) rotate(-42)`}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function WeekdayChart({ sessions }: { sessions: SessionWithBreaks[] }) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const totals = Array(7).fill(0) as number[]
  const counts = Array(7).fill(0) as number[]
  sessions.forEach((s) => {
    const d = getDay(new Date(s.date + 'T00:00:00'))
    totals[d] += s.total_hours
    counts[d]++
  })
  const avgs = totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : 0))
  const maxH = Math.max(...avgs, 0.1)

  const W = 240, CH = 110, PL = 36, PR = 8, PT = 12, PB = 26
  const areaW = W - PL - PR
  const barW = areaW / 7 - 5

  return (
    <svg viewBox={`0 0 ${W} ${PT + CH + PB}`} style={{ width: '100%', display: 'block', color: 'var(--text-primary)' }}>
      <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      {[0.5, 1].map((pct) => {
        const y = PT + CH * (1 - pct)
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.07} strokeWidth={0.4} />
            <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="currentColor" opacity={0.45}>
              {(maxH * pct).toFixed(1)}
            </text>
          </g>
        )
      })}
      {avgs.map((avg, i) => {
        const barH = Math.max(0, (avg / maxH) * CH)
        const cx = PL + (i + 0.5) * (areaW / 7)
        const x = cx - barW / 2
        const y = PT + CH - barH
        return (
          <g key={i}>
            {barH > 0 && <rect x={x} y={y} width={barW} height={barH} fill="var(--info)" rx={2} opacity={0.8} />}
            <text x={cx} y={PT + CH + 14} textAnchor="middle" fontSize={8.5} fill="currentColor" opacity={0.55}>
              {DAYS[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function CumulativeChart({ sessions }: { sessions: SessionWithBreaks[] }) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const points: { date: string; cum: number }[] = []
  let cum = 0
  sorted.forEach((s) => {
    cum += s.total_hours
    const last = points[points.length - 1]
    if (last?.date === s.date) last.cum = cum
    else points.push({ date: s.date, cum })
  })

  if (points.length < 2) {
    return (
      <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Not enough data
      </div>
    )
  }

  const maxCum = points[points.length - 1].cum
  const W = 240, CH = 110, PL = 40, PR = 8, PT = 12, PB = 26
  const areaW = W - PL - PR

  const toXY = (i: number, val: number) => ({
    x: PL + (i / (points.length - 1)) * areaW,
    y: PT + CH - (val / maxCum) * CH,
  })

  const linePath = points.map((p, i) => {
    const { x, y } = toXY(i, p.cum)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const areaPath = [
    `M${PL},${PT + CH}`,
    ...points.map((p, i) => { const { x, y } = toXY(i, p.cum); return `L${x.toFixed(1)},${y.toFixed(1)}` }),
    `L${(PL + areaW).toFixed(1)},${PT + CH}Z`,
  ].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${PT + CH + PB}`} style={{ width: '100%', display: 'block', color: 'var(--text-primary)' }}>
      <defs>
        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--success)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--success)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={PL} y1={PT + CH} x2={W - PR} y2={PT + CH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      {[0.5, 1].map((pct) => {
        const y = PT + CH * (1 - pct)
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity={0.07} strokeWidth={0.4} />
            <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="currentColor" opacity={0.45}>
              {(maxCum * pct).toFixed(1)}h
            </text>
          </g>
        )
      })}
      <path d={areaPath} fill="url(#cumGrad)" />
      <path d={linePath} fill="none" stroke="var(--success)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {([0, points.length - 1] as const).map((idx) => {
        const { x, y } = toXY(idx, points[idx].cum)
        return <circle key={idx} cx={x} cy={y} r={3} fill="var(--success)" />
      })}
      <text x={PL} y={PT + CH + 16} fontSize={8} fill="currentColor" opacity={0.5}>
        {format(new Date(points[0].date + 'T00:00:00'), 'MMM d')}
      </text>
      <text x={PL + areaW} y={PT + CH + 16} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.5}>
        {format(new Date(points[points.length - 1].date + 'T00:00:00'), 'MMM d')}
      </text>
    </svg>
  )
}

// ── Pagination Component ──────────────────────────────────────────

const PAGE_SIZE = 5

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', flexWrap: 'wrap' }}>
      <button
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 0 ? 0.5 : 1 }}
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <button key={i} onClick={() => onPage(i)} style={{ width: '32px', height: '32px', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: page === i ? 700 : 400, backgroundColor: page === i ? 'var(--accent)' : 'var(--bg-secondary)', color: page === i ? 'white' : 'var(--text-secondary)', border: `1px solid ${page === i ? 'var(--accent)' : 'var(--border)'}` }}>
            {i + 1}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [sessionLogPage, setSessionLogPage] = useState(0)

  // Reset page when date range changes
  const handleStartDate = useCallback((d: string) => { setStartDate(d); setSessionLogPage(0) }, [])
  const handleEndDate = useCallback((d: string) => { setEndDate(d); setSessionLogPage(0) }, [])

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

  const dateRangeLabel = startDate && endDate
    ? `${format(new Date(startDate + 'T00:00:00'), 'MMM d')} – ${format(new Date(endDate + 'T00:00:00'), 'MMM d, yyyy')}`
    : ''

  // ── CSV Export ──────────────────────────────────────────────────
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

  // ── PDF Export ──────────────────────────────────────────────────
  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const margin = 20
    const contentW = pageW - margin * 2

    const C = {
      black:  [0, 0, 0]         as [number, number, number],
      dark:   [30, 30, 30]      as [number, number, number],
      mid:    [90, 90, 90]      as [number, number, number],
      light:  [150, 150, 150]   as [number, number, number],
      rule:   [180, 180, 180]   as [number, number, number],
      thead:  [230, 230, 230]   as [number, number, number],
      rowAlt: [247, 247, 247]   as [number, number, number],
    }

    function hRule(y: number) {
      doc.setDrawColor(...C.rule)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageW - margin, y)
    }

    // ── Title ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...C.dark)
    doc.text('OJT PROGRESS REPORT', margin, 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C.mid)
    doc.text(`Reporting Period: ${dateRangeLabel}`, margin, 28)
    doc.text(`Date Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margin, 34)

    hRule(38)

    // ── Student Information ──
    let y = 46
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.mid)
    doc.text('STUDENT INFORMATION', margin, y)

    y += 6
    const halfW = contentW / 2
    const infoRows: [string, string, string, string][] = [
      ['Name',       (profile?.full_name ?? user?.email ?? '—'), 'School',     profile?.school || '—'],
      ['Year Level', profile?.year_level || '—',                  'Workplace',  profile?.workplace || '—'],
    ]
    infoRows.forEach(([l1, v1, l2, v2]) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.light)
      doc.text(l1, margin, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.dark)
      doc.text(v1.slice(0, 32), margin + 22, y)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.light)
      doc.text(l2, margin + halfW, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.dark)
      doc.text(v2.slice(0, 32), margin + halfW + 24, y)
      y += 7
    })

    hRule(y + 3)
    y += 10

    // ── Summary ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.mid)
    doc.text('REPORT SUMMARY', margin, y)

    y += 7
    const statColW = contentW / 4
    const statDefs = [
      { label: 'Total Hours',   value: formatHours(totalHours) },
      { label: 'Days Attended', value: uniqueDays.toString() },
      { label: 'Avg per Day',   value: avgHrsPerDay > 0 ? formatHours(avgHrsPerDay) : '—' },
      { label: 'Sessions',      value: sessions.length.toString() },
    ]
    statDefs.forEach(({ label, value }, i) => {
      const x = margin + i * statColW
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.light)
      doc.text(label, x, y)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...C.dark)
      doc.text(value, x, y + 8)
    })

    y += 16

    // ── OJT Progress ──
    if (ojtSetup?.required_hours) {
      const pct = Math.min(100, (totalHours / ojtSetup.required_hours) * 100)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...C.mid)
      doc.text('OJT Progress:', margin, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.dark)
      doc.text(
        `${totalHours.toFixed(1)} of ${ojtSetup.required_hours}h  (${pct.toFixed(1)}% complete)`,
        margin + 26, y,
      )
      y += 5
      const bwt = contentW
      doc.setFillColor(...C.rule)
      doc.rect(margin, y, bwt, 3, 'F')
      if (pct > 0) {
        doc.setFillColor(...C.mid)
        doc.rect(margin, y, Math.max(2, bwt * pct / 100), 3, 'F')
      }
      y += 9
    }

    hRule(y + 1)
    y += 8

    // ── Session Log ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.mid)
    doc.text('SESSION LOG', margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Time In', 'Time Out', 'Duration', 'Hours', 'Journal']],
      body: sessions.map((s) => [
        format(new Date(s.date + 'T00:00:00'), 'MMM d, yyyy'),
        formatTime12h(s.start_time),
        s.end_time ? formatTime12h(s.end_time) : '—',
        formatDuration(s.duration),
        s.total_hours.toFixed(2) + 'h',
        s.journal ? s.journal.slice(0, 55) : '—',
      ]),
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: C.dark,
        lineColor: C.rule,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: C.thead,
        textColor: C.dark,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: C.rowAlt },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 16 },
        5: { cellWidth: 'auto' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didDrawPage: (data: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages()
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
        doc.setDrawColor(...C.rule)
        doc.setLineWidth(0.3)
        doc.line(margin, 284, pageW - margin, 284)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...C.light)
        doc.text('OJT Tracker', margin, 290)
        doc.text(`Page ${pageNum} of ${pageCount}`, pageW - margin, 290, { align: 'right' })
        void data
      },
    })

    doc.save(`ojt-report-${startDate}-to-${endDate}.pdf`)
  }

  // ── Render ───────────────────────────────────────────────────────
  const statCards = [
    { icon: Clock,       label: 'Total Hours',   value: formatHours(totalHours),                                 color: 'var(--accent)' },
    { icon: CalendarDays,label: 'Days Attended', value: uniqueDays.toString(),                                   color: 'var(--accent)' },
    { icon: TrendingUp,  label: 'Avg / Day',     value: avgHrsPerDay > 0 ? formatHours(avgHrsPerDay) : '—',      color: 'var(--accent)' },
    { icon: BarChart3,   label: 'Sessions',      value: sessions.length.toString(),                              color: 'var(--accent)' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="page-header-text">
          <h1>Reports</h1>
          <p>Analyze and export your OJT session data</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', padding: '0.5rem 1rem',
              borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            <Download size={14} /> <span className="btn-label">Save as CSV</span>
          </button>
          <button
            onClick={exportPDF}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              backgroundColor: 'var(--accent)', color: 'white',
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              fontSize: '0.875rem', fontWeight: 700,
            }}
          >
            <FileDown size={14} /> <span className="btn-label">Save as PDF</span>
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={15} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Date Range</h2>
          {dateRangeLabel && (
            <span style={{ marginLeft: 'auto', backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '0.375rem', padding: '0.2rem 0.625rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              {dateRangeLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</label>
            <DatePicker value={startDate} onChange={handleStartDate} placeholder="Select start date" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</label>
            <DatePicker value={endDate} onChange={handleEndDate} placeholder="Select end date" />
          </div>
        </div>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {statCards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '0.5rem', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} style={{ color }} />
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            {totalBreaks > 0 && label === 'Sessions' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>{totalBreaks} breaks total</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {!isLoading && sessions.length > 0 && (
        <>
          {/* Daily Hours — Full Width */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <BarChart3 size={15} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Daily Hours</h2>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateRangeLabel}</span>
            </div>
            <DailyHoursChart sessions={sessions} />
          </div>

          {/* Weekday Avg + Cumulative — Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CalendarDays size={15} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Avg by Weekday</h2>
              </div>
              <WeekdayChart sessions={sessions} />
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cumulative Hours</h2>
              </div>
              <CumulativeChart sessions={sessions} />
            </div>
          </div>
        </>
      )}

      {/* ── Session Log Table ── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Session Log
            {sessions.length > 0 && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
              </span>
            )}
          </h2>
          {dateRangeLabel && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{dateRangeLabel}</span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sessions in this date range.</div>
        ) : (() => {
          const logTotalPages = Math.ceil(sessions.length / PAGE_SIZE)
          const paginated = sessions.slice(sessionLogPage * PAGE_SIZE, (sessionLogPage + 1) * PAGE_SIZE)
          return (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-modifier)' }}>
                      {['Date', 'Time In', 'Time Out', 'Duration', 'Hours', 'Journal'].map((h) => (
                        <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((session, i) => (
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
              <Pagination page={sessionLogPage} totalPages={logTotalPages} onPage={setSessionLogPage} />
            </>
          )
        })()}
      </div>
    </motion.div>
  )
}
