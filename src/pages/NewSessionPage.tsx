import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, ArrowLeft, Sparkles, ImagePlus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { TimePicker } from '../components/ui/TimePicker'
import { DatePicker } from '../components/ui/DatePicker'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { calcTotalHours, calcBreakDuration, toTimeString, toInputTime } from '../utils/timeUtils'
import { useToast } from '../components/ui/Toast'
import { format } from 'date-fns'

interface BreakRow {
  start: string
  end: string
}

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

export default function NewSessionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(today)
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const [journal, setJournal] = useState('')
  const [showJournal, setShowJournal] = useState(false)
  const [breaks, setBreaks] = useState<BreakRow[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const { data: avgSchedule } = useQuery({
    queryKey: ['avgSchedule', user?.id],
    queryFn: () => SessionService.getAverageSchedule(user!.id),
    enabled: !!user?.id,
  })

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

      // Upload images first
      let imageUrls: string[] | null = null
      if (imageFiles.length > 0) {
        const urls = await Promise.all(
          imageFiles.map((f) => SessionService.uploadSessionImage(f, user.id))
        )
        imageUrls = urls
      }

      return SessionService.createManualSession(
        user.id,
        date,
        startTs,
        endTs,
        totalHours,
        durationMin,
        journal || null,
        breakData,
        imageUrls
      )
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['totalHours'] })
      queryClient.invalidateQueries({ queryKey: ['daysCount'] })
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] })
      toast('Session saved successfully!', 'success')
      navigate(`/logs/${session.id}`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
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

  function useAverageSchedule() {
    if (!avgSchedule?.avgTimeIn || !avgSchedule?.avgTimeOut) {
      toast('No past sessions to calculate average from.', 'info')
      return
    }
    setTimeIn(toInputTime(avgSchedule.avgTimeIn))
    setTimeOut(toInputTime(avgSchedule.avgTimeOut))
    toast(`Filled with your average schedule (${avgSchedule.avgTotalHours}h avg)`, 'success')
  }

  function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
    setImageFiles((prev) => [...prev, ...files])
    if (e.target) e.target.value = ''
  }

  function removeImage(idx: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx))
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  // Computed total hours for display
  const startTs = timeIn ? toTimeString(timeIn) : null
  const endTs = timeOut ? toTimeString(timeOut) : null
  const breakData = breaks.filter((b) => b.start && b.end).map((b) => ({
    start_time: toTimeString(b.start),
    end_time: toTimeString(b.end),
    duration: calcBreakDuration(toTimeString(b.start), toTimeString(b.end)),
  }))
  const computedHours = startTs && endTs ? calcTotalHours(startTs, endTs, breakData) : 0

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '860px', margin: '0 auto' }}
    >
      <style>{spinStyle}</style>

      {/* Back link */}
      <Link
        to="/logs"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', textDecoration: 'none' }}
      >
        <ArrowLeft size={16} /> Back to Logs
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Plus size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Manual Time Entry
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>
            Enter your time manually for days you forgot to clock in/out
          </p>
        </div>
      </div>

      {/* Info note */}
      <div style={{
        backgroundColor: 'var(--accent-light)',
        border: '1px solid var(--accent-border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.25rem',
        marginTop: '0.75rem',
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Manual Entry Information</strong>
        <br />
        Use this feature only when you forget to clock in/out. All entries must be at least 15 minutes and follow OJT time tracking rules.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Date + Time row */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date *</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time In *</label>
              <TimePicker value={timeIn} onChange={setTimeIn} placeholder="Select time in" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Out *</label>
              <TimePicker value={timeOut} onChange={setTimeOut} placeholder="Select time out" />
            </div>
          </div>

          {/* Use Average + Calculated hours row */}
          <div style={{ display: 'grid', gridTemplateColumns: computedHours > 0 ? '1fr auto' : '1fr', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={useAverageSchedule}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--accent-light)',
                border: '1px solid var(--accent-border)',
                borderRadius: '0.5rem',
                color: 'var(--accent)',
                fontSize: '0.875rem', fontWeight: 700,
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-border)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-light)' }}
            >
              <Sparkles size={16} /> Use Average Time
              {avgSchedule?.avgTotalHours ? ` (avg ${avgSchedule.avgTotalHours}h)` : ''}
            </button>
            {computedHours > 0 && (
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.625rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</span>
                <span style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--accent)' }}>{computedHours.toFixed(2)}h</span>
              </div>
            )}
          </div>

          {/* Breaks + Images side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch' }}>

            {/* Breaks */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: breaks.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Break Periods
                </label>
                <button type="button" onClick={addBreak}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 700 }}>
                  <Plus size={14} /> Add Break
                </button>
              </div>
              {breaks.length === 0 && (
                <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  No breaks added
                </div>
              )}
              {breaks.map((brk, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '0.875rem 1.25rem', borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Break {idx + 1}</span>
                    <button type="button" onClick={() => removeBreak(idx)} style={{ color: 'var(--error)', padding: '0.25rem' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Start</label>
                      <TimePicker value={brk.start} onChange={(v) => updateBreak(idx, 'start', v)} placeholder="Start"
                        triggerStyle={{ padding: '0.625rem 0.75rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>End</label>
                      <TimePicker value={brk.end} onChange={(v) => updateBreak(idx, 'end', v)} placeholder="End"
                        triggerStyle={{ padding: '0.625rem 0.75rem 0.625rem 2.5rem', fontSize: '0.875rem' }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Daily Images */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                Daily Images <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
              {imagePreviews.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {imagePreviews.map((src, idx) => (
                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeImage(idx)}
                        style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', width: '100%', backgroundColor: 'transparent', border: '2px dashed var(--border)', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, transition: 'border-color 150ms, color 150ms' }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text-muted)' }}
              >
                <ImagePlus size={18} />
                {imagePreviews.length > 0 ? 'Add more images' : 'Add images for this session'}
              </button>
            </div>

          </div>

          {/* Journal */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <button type="button" onClick={() => setShowJournal(!showJournal)}
              style={{ width: '100%', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
              <span>Journal <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(optional)</span></span>
              {showJournal ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {showJournal && (
              <div style={{ padding: '0 1.25rem 1.25rem' }}>
                <textarea
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  rows={5}
                  placeholder="Write about your experience, learnings, or reflections for today…"
                  style={{
                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.5rem',
                    padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: '0.9375rem',
                    outline: 'none', width: '100%', resize: 'vertical', minHeight: '110px',
                    transition: 'border-color 150ms, box-shadow 150ms', fontFamily: 'inherit',
                  }}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            )}
          </div>

          {/* Submit + Cancel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
            <button type="submit" disabled={isPending}
              style={{ backgroundColor: 'var(--accent)', color: 'white', borderRadius: '0.5rem', padding: '0.875rem', fontWeight: 700, fontSize: '0.9375rem', opacity: isPending ? 0.75 : 1, transition: 'opacity 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {isPending ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : 'Save Manual Entry'}
            </button>
            <Link to="/logs"
              style={{ padding: '0.875rem 1.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Cancel
            </Link>
          </div>

        </div>
      </form>
    </motion.div>
  )
}
