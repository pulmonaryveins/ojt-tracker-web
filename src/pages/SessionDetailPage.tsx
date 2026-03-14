import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Pencil, Trash2, X, Check, Plus, ImagePlus, Download, ChevronDown, ChevronUp, CalendarDays, Clock, Coffee, ClipboardList, Images } from 'lucide-react'
import { TimePicker } from '../components/ui/TimePicker'
import { DatePicker } from '../components/ui/DatePicker'
import { format } from 'date-fns'
import SessionService from '../services/sessionService'
import { useAuthStore } from '../stores/authStore'
import { formatTime12h, formatDuration, calcTotalHours, calcBreakDuration, toTimeString, toInputTime } from '../utils/timeUtils'
import { ConfirmModal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

interface BreakRow {
  id?: string
  start: string
  end: string
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showJournal, setShowJournal] = useState(true)

  // Edit state
  const [editDate, setEditDate] = useState('')
  const [editTimeIn, setEditTimeIn] = useState('')
  const [editTimeOut, setEditTimeOut] = useState('')
  const [editJournal, setEditJournal] = useState('')
  const [editBreaks, setEditBreaks] = useState<BreakRow[]>([])
  const [editImages, setEditImages] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])

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
    setEditJournal(session.journal ?? '')
    setEditBreaks(
      session.breaks.map((b) => ({
        id: b.id,
        start: toInputTime(b.start_time),
        end: toInputTime(b.end_time ?? null),
      }))
    )
    setEditImages(session.report_images ?? [])
    setNewImageFiles([])
    setNewImagePreviews([])
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

      // Upload new images
      let finalImages = [...editImages]
      if (newImageFiles.length > 0 && user?.id) {
        const urls = await Promise.all(
          newImageFiles.map((f) => SessionService.uploadSessionImage(f, user.id))
        )
        finalImages = [...finalImages, ...urls]
      }

      await SessionService.updateSession(id, {
        date: editDate,
        start_time: startTs,
        end_time: endTs,
        total_hours: totalHours,
        duration: durationMin,
        journal: editJournal || null,
        report_images: finalImages.length > 0 ? finalImages : null,
      })
      await SessionService.updateSessionBreaks(id, breakData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      toast('Session updated successfully!', 'success')
      setIsEditing(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const { mutate: deleteSession, isPending: isDeleting } = useMutation({
    mutationFn: () => SessionService.deleteSession(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['daysCount'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      toast('Session deleted.', 'info')
      navigate('/logs')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleNewImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setNewImagePreviews((prev) => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
    setNewImageFiles((prev) => [...prev, ...files])
    if (e.target) e.target.value = ''
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
      </div>
    )
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '860px', margin: '0 auto' }}
    >
      <style>{spinStyle}</style>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteSession()}
        title="Delete Session"
        message="This action cannot be undone. The session and all its breaks will be permanently deleted."
        confirmLabel="Delete Session"
        confirmDanger
        loading={isDeleting}
      />

      {/* Header */}
      <div className="detail-topbar">
        <Link to="/logs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> <span className="btn-label">Back to Activity Logs</span>
        </Link>
        <div className="detail-topbar-actions">
          {!isEditing ? (
            <>
              <button onClick={enterEditMode}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                <Pencil size={14} /> <span className="btn-label">Edit</span>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'rgba(218,55,60,0.1)', border: '1px solid rgba(218,55,60,0.3)', color: 'var(--error)', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                <Trash2 size={14} /> <span className="btn-label">Delete</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => saveEdit()} disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--success)', color: 'white', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, opacity: isSaving ? 0.7 : 1 }}>
                <Check size={14} /> <span className="btn-label">{isSaving ? 'Saving…' : 'Save Changes'}</span>
              </button>
              <button onClick={() => setIsEditing(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                <X size={14} /> <span className="btn-label">Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ClipboardList size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Session Details
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <CalendarDays size={13} style={{ color: 'var(--accent)' }} />
            {isEditing
              ? format(new Date(editDate + 'T00:00:00'), 'EEEE, MMMM dd, yyyy')
              : format(new Date(session.date + 'T00:00:00'), 'EEEE, MMMM dd, yyyy')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Time Information — full width */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Clock size={13} /> Time Information
          </h2>
          {isEditing ? (
            <div className="grid-3-col">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</label>
                <DatePicker value={editDate} onChange={setEditDate}
                  triggerStyle={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Time In</label>
                <TimePicker value={editTimeIn} onChange={setEditTimeIn} placeholder="Select time in"
                  triggerStyle={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Time Out</label>
                <TimePicker value={editTimeOut} onChange={setEditTimeOut} placeholder="Select time out"
                  triggerStyle={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
              </div>
            </div>
          ) : (
            <div className="grid-3-col" style={{ gap: '0.75rem' }}>
              {[
                { label: 'Time In', value: formatTime12h(session.start_time) },
                { label: 'Time Out', value: formatTime12h(session.end_time) },
                { label: 'Total Hours', value: `${session.total_hours.toFixed(2)}h` },
              ].map(({ label, value }) => (
                <div key={label} style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '0.5rem', padding: '0.875rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.375rem' }}>{label}</div>
                  <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breaks — full width */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Coffee size={13} /> Breaks
            </h2>
            {isEditing && (
              <button type="button" onClick={() => setEditBreaks((prev) => [...prev, { start: '', end: '' }])}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 700 }}>
                <Plus size={14} /> Add Break
              </button>
            )}
          </div>
          {isEditing ? (
            editBreaks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No breaks added.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.5rem' }}>
                {editBreaks.map((brk, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', backgroundColor: 'var(--bg-modifier)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <TimePicker value={brk.start} onChange={(v) => setEditBreaks((prev) => prev.map((b, i) => i === idx ? { ...b, start: v } : b))}
                        placeholder="Start" triggerStyle={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
                      <TimePicker value={brk.end} onChange={(v) => setEditBreaks((prev) => prev.map((b, i) => i === idx ? { ...b, end: v } : b))}
                        placeholder="End" triggerStyle={{ padding: '0.625rem 0.875rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
              {session.breaks.map((brk, idx) => (
                <div key={brk.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-modifier)', borderRadius: '0.375rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Break {idx + 1}: {formatTime12h(brk.start_time)} – {formatTime12h(brk.end_time)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>{formatDuration(brk.duration)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Journal */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <button onClick={() => setShowJournal(!showJournal)}
            style={{ width: '100%', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><ClipboardList size={13} /> Journal</span>
            {showJournal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showJournal && (
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              {isEditing ? (
                <textarea value={editJournal} onChange={(e) => setEditJournal(e.target.value)} rows={5}
                  placeholder="Write about your experience, learnings, or reflections…"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: '0.9375rem', outline: 'none', width: '100%', resize: 'vertical', minHeight: '110px', transition: 'border-color 150ms', fontFamily: 'inherit' }}
                  onFocus={onFocus} onBlur={onBlur} />
              ) : session.journal ? (
                <p style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{session.journal}</p>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>No report created yet</p>
                  <button onClick={enterEditMode}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, border: '1px solid var(--accent-light)', padding: '0.5rem 1rem', borderRadius: '0.375rem', backgroundColor: 'var(--accent-light)' }}>
                    <Plus size={15} /> Add Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Images */}
        {((session.report_images && session.report_images.length > 0) || isEditing) && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Images size={13} /> Session Images
            </h2>
            {(isEditing ? editImages : (session.report_images ?? [])).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: isEditing ? '0.75rem' : 0 }}>
                {(isEditing ? editImages : (session.report_images ?? [])).map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {!isEditing && (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '4px', padding: '3px 5px', display: 'flex', alignItems: 'center' }}>
                        <Download size={12} />
                      </a>
                    )}
                    {isEditing && (
                      <button onClick={() => setEditImages((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isEditing && newImagePreviews.map((src, idx) => (
                  <div key={`new-${idx}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '0.5rem', overflow: 'hidden', border: '2px dashed var(--accent)' }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => { setNewImagePreviews((p) => p.filter((_, i) => i !== idx)); setNewImageFiles((p) => p.filter((_, i) => i !== idx)) }}
                      style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isEditing && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleNewImages} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.75rem', backgroundColor: 'transparent', border: '2px dashed var(--border)', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                  <ImagePlus size={16} /> Add images
                </button>
              </>
            )}
          </div>
        )}

        {/* Bottom action row */}
        {isEditing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button onClick={() => saveEdit()} disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--success)', color: 'white', borderRadius: '0.5rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9375rem', opacity: isSaving ? 0.7 : 1 }}>
              <Check size={16} /> {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setIsEditing(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '0.5rem', padding: '0.875rem', fontWeight: 600, fontSize: '0.875rem' }}>
              <X size={15} /> Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button onClick={() => toast('PDF export coming soon!', 'info')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '0.5rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9375rem' }}>
              <Download size={18} /> Export as PDF
            </button>
            <Link to="/logs"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '0.5rem', padding: '0.875rem', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
              <ArrowLeft size={16} /> Back to Logs
            </Link>
          </div>
        )}

      </div>
    </motion.div>
  )
}
