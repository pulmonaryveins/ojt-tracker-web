import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { calcTotalHours, calcBreakDuration, toTimeString } from '../utils/timeUtils'
import { format } from 'date-fns'

interface BreakRow {
  start: string
  end: string
}

const inputStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  padding: '0.625rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
} as const

export default function NewSessionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(today)
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const [notes, setNotes] = useState('')
  const [breaks, setBreaks] = useState<BreakRow[]>([])
  const [error, setError] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated')
      if (!timeIn) throw new Error('Time In is required')

      const startTs = toTimeString(timeIn)
      const endTs = timeOut ? toTimeString(timeOut) : null

      const breakData = breaks
        .filter((b) => b.start && b.end)
        .map((b) => ({
          start_time: toTimeString(b.start),
          end_time: toTimeString(b.end),
          duration: calcBreakDuration(toTimeString(b.start), toTimeString(b.end)),
        }))

      const totalHours = calcTotalHours(startTs, endTs, breakData)
      const durationMin = endTs
        ? Math.round(totalHours * 60) + breakData.reduce((s, b) => s + b.duration, 0)
        : 0

      return SessionService.createManualSession(
        user.id,
        date,
        startTs,
        endTs,
        totalHours,
        durationMin,
        notes || null,
        breakData
      )
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['daysCount'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      navigate(`/logs/${session.id}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    mutate()
  }

  function addBreak() {
    setBreaks((prev) => [...prev, { start: '', end: '' }])
  }

  function removeBreak(idx: number) {
    setBreaks((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateBreak(idx: number, field: 'start' | 'end', value: string) {
    setBreaks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)))
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Back link */}
      <Link
        to="/logs"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', textDecoration: 'none' }}
      >
        <ArrowLeft size={16} /> Back to Logs
      </Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.5rem' }}>New Session</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.75rem', color: 'var(--error)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
          />
        </div>

        {/* Time In / Out */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Time In *</label>
            <input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Time Out</label>
            <input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>
        </div>

        {/* Breaks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Breaks</label>
            <button type="button" onClick={addBreak}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500 }}>
              <Plus size={14} /> Add Break
            </button>
          </div>

          {breaks.map((brk, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: 'var(--bg-modifier)', borderRadius: '0.375rem', padding: '0.75rem' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Break Start</label>
                  <input type="time" value={brk.start} onChange={(e) => updateBreak(idx, 'start', e.target.value)} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Break End</label>
                  <input type="time" value={brk.end} onChange={(e) => updateBreak(idx, 'end', e.target.value)} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
              </div>
              <button type="button" onClick={() => removeBreak(idx)}
                style={{ color: 'var(--error)', padding: '0.25rem', flexShrink: 0 }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes / Description</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did you work on today?"
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              flex: 1,
              backgroundColor: isPending ? 'var(--accent-hover)' : 'var(--accent)',
              color: 'white',
              borderRadius: '0.375rem',
              padding: '0.625rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              opacity: isPending ? 0.7 : 1,
              transition: 'background-color 150ms',
            }}
          >
            {isPending ? 'Saving…' : 'Save Session'}
          </button>
          <Link
            to="/logs"
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
