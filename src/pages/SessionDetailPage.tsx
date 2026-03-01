import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, X, Check, Plus } from 'lucide-react'
import SessionService from '../services/sessionService'
import { formatTime12h, formatHours, formatDuration, calcTotalHours, calcBreakDuration, toTimeString, toInputTime } from '../utils/timeUtils'
import { format } from 'date-fns'

const inputStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  padding: '0.5rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
} as const

interface BreakRow {
  id?: string
  start: string
  end: string
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState('')

  // Edit state
  const [editDate, setEditDate] = useState('')
  const [editTimeIn, setEditTimeIn] = useState('')
  const [editTimeOut, setEditTimeOut] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editJournal, setEditJournal] = useState('')
  const [editBreaks, setEditBreaks] = useState<BreakRow[]>([])

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => SessionService.getSessionByIdWithBreaks(id!),
    enabled: !!id,
  })

  function enterEditMode() {
    if (!session) return
    setEditDate(session.date)
    setEditTimeIn(toInputTime(session.start_time))
    setEditTimeOut(toInputTime(session.end_time))
    setEditNotes(session.description ?? '')
    setEditJournal(session.journal ?? '')
    setEditBreaks(
      session.breaks.map((b) => ({
        id: b.id,
        start: toInputTime(b.start_time),
        end: toInputTime(b.end_time ?? null),
      }))
    )
    setError('')
    setIsEditing(true)
  }

  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No session id')
      const startTs = toTimeString(editTimeIn)
      const endTs = editTimeOut ? toTimeString(editTimeOut) : null

      const breakData = editBreaks
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

      await SessionService.updateSession(id, {
        date: editDate,
        start_time: startTs,
        end_time: endTs,
        total_hours: totalHours,
        duration: durationMin,
        description: editNotes || null,
        journal: editJournal || null,
      })
      await SessionService.updateSessionBreaks(id, breakData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      setIsEditing(false)
    },
    onError: (err: Error) => setError(err.message),
  })

  const { mutate: deleteSession, isPending: isDeleting } = useMutation({
    mutationFn: () => SessionService.deleteSession(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['daysCount'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      navigate('/logs')
    },
    onError: (err: Error) => setError(err.message),
  })

  if (isLoading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading…</div>
  }

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Session not found.</p>
        <Link to="/logs" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>Back to Logs</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/logs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Logs
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isEditing ? (
            <>
              <button onClick={enterEditMode}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'rgba(218,55,60,0.15)', color: 'var(--error)', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => saveEdit()}
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--success)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, opacity: isSaving ? 0.7 : 1 }}>
                <Check size={14} /> {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
                <X size={14} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.75rem', color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--error)', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 0.5rem' }}>Delete this session?</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => deleteSession()} disabled={isDeleting}
              style={{ backgroundColor: '#da373c', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Date & Times Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Session Info</h2>

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Time In</label>
                  <input type="time" value={editTimeIn} onChange={(e) => setEditTimeIn(e.target.value)} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Time Out</label>
                  <input type="time" value={editTimeOut} onChange={(e) => setEditTimeOut(e.target.value)} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Date', value: format(new Date(session.date + 'T00:00:00'), 'MMMM d, yyyy') },
                { label: 'Time In', value: formatTime12h(session.start_time) },
                { label: 'Time Out', value: formatTime12h(session.end_time) },
                { label: 'Total Hours', value: formatHours(session.total_hours) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breaks Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Breaks</h2>
            {isEditing && (
              <button type="button" onClick={() => setEditBreaks((prev) => [...prev, { start: '', end: '' }])}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 500 }}>
                <Plus size={14} /> Add Break
              </button>
            )}
          </div>

          {isEditing ? (
            editBreaks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No breaks added.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {editBreaks.map((brk, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: 'var(--bg-modifier)', borderRadius: '0.375rem', padding: '0.625rem' }}>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="time" value={brk.start} onChange={(e) => setEditBreaks((prev) => prev.map((b, i) => i === idx ? { ...b, start: e.target.value } : b))} style={inputStyle}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
                      <input type="time" value={brk.end} onChange={(e) => setEditBreaks((prev) => prev.map((b, i) => i === idx ? { ...b, end: e.target.value } : b))} style={inputStyle}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
                    </div>
                    <button type="button" onClick={() => setEditBreaks((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ color: 'var(--error)', padding: '0.25rem', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : session.breaks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No breaks recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {session.breaks.map((brk, idx) => (
                <div key={brk.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-modifier)', borderRadius: '0.375rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Break {idx + 1}: {formatTime12h(brk.start_time)} – {formatTime12h(brk.end_time)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{formatDuration(brk.duration)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Notes</h2>
          {isEditing ? (
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} placeholder="What did you work on?"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          ) : (
            <p style={{ color: session.description ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, whiteSpace: 'pre-wrap' }}>
              {session.description ?? 'No notes recorded.'}
            </p>
          )}
        </div>

        {/* Journal Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Journal</h2>
          {isEditing ? (
            <textarea value={editJournal} onChange={(e) => setEditJournal(e.target.value)} rows={6} placeholder="Write about your experience, learnings, or reflections…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          ) : (
            <p style={{ color: session.journal ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, whiteSpace: 'pre-wrap' }}>
              {session.journal ?? 'No journal entry yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
