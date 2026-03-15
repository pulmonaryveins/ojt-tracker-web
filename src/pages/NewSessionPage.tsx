import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trash2, ArrowLeft, Sparkles, ImagePlus, X, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { TimePicker } from '../components/ui/TimePicker'
import { DatePicker } from '../components/ui/DatePicker'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { supabase } from '../lib/supabase'
import { calcTotalHours, calcBreakDuration, toTimeString, toInputTime } from '../utils/timeUtils'
import { useToast } from '../components/ui/Toast'
import { format, parseISO } from 'date-fns'

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

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(todayStr)
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

  const { data: avgBreaks } = useQuery({
    queryKey: ['avgBreaks', user?.id],
    queryFn: () => SessionService.getAverageBreaks(user!.id),
    enabled: !!user?.id,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated')

      // ── Date validations ──
      const today = format(new Date(), 'yyyy-MM-dd') // eslint-disable-line @typescript-eslint/no-shadow
      if (!date) throw new Error('Date is required.')
      if (date > today) throw new Error('Session date cannot be in the future.')
      const selectedDate = parseISO(date)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      if (selectedDate < oneYearAgo) throw new Error('Session date cannot be more than 1 year in the past.')

      // ── 1 session per day ──
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle()
      if (existing) throw new Error(`A session already exists for ${format(selectedDate, 'MMMM d, yyyy')}. Only 1 session per day is allowed.`)

      // ── Time validations ──
      if (!timeIn) throw new Error('Time In is required.')
      if (!timeOut) throw new Error('Time Out is required.')

      const startTs = toTimeString(timeIn)
      const endTs = toTimeString(timeOut)

      const [startH, startM] = timeIn.split(':').map(Number)
      const [endH, endM] = timeOut.split(':').map(Number)
      const startMins = startH * 60 + startM
      const endMins = endH * 60 + endM
      if (endMins <= startMins) throw new Error('Time Out must be after Time In.')

      const rawDurationMin = endMins - startMins
      if (rawDurationMin < 15) throw new Error('Session must be at least 15 minutes.')
      if (rawDurationMin > 16 * 60) throw new Error('Session cannot exceed 16 hours. Please verify your times.')

      // ── Break validations ──
      const incompleteBreak = breaks.find((b) => (b.start && !b.end) || (!b.start && b.end))
      if (incompleteBreak) throw new Error('Each break must have both a start and end time.')

      const breakData = breaks
        .filter((b) => b.start && b.end)
        .map((b) => ({
          start_time: toTimeString(b.start),
          end_time: toTimeString(b.end),
          duration: calcBreakDuration(toTimeString(b.start), toTimeString(b.end)),
        }))

      for (const [i, brk] of breaks.filter((b) => b.start && b.end).entries()) {
        const [bs, bsm] = brk.start.split(':').map(Number)
        const [be, bem] = brk.end.split(':').map(Number)
        const bStartMins = bs * 60 + bsm
        const bEndMins = be * 60 + bem
        if (bEndMins <= bStartMins) throw new Error(`Break ${i + 1}: end time must be after start time.`)
        if (bStartMins < startMins) throw new Error(`Break ${i + 1}: cannot start before session Time In.`)
        if (bEndMins > endMins) throw new Error(`Break ${i + 1}: cannot end after session Time Out.`)
        if (bEndMins - bStartMins < 5) throw new Error(`Break ${i + 1}: must be at least 5 minutes.`)
      }

      // Check breaks don't overlap
      const sortedBreaks = breaks
        .filter((b) => b.start && b.end)
        .map((b) => { const [h,m] = b.start.split(':').map(Number); const [h2,m2] = b.end.split(':').map(Number); return { s: h*60+m, e: h2*60+m2 } })
        .sort((a, b) => a.s - b.s)
      for (let i = 0; i < sortedBreaks.length - 1; i++) {
        if (sortedBreaks[i].e > sortedBreaks[i + 1].s) throw new Error(`Breaks overlap. Please fix break ${i + 1} and ${i + 2}.`)
      }

      const totalHours = calcTotalHours(startTs, endTs, breakData)
      if (totalHours < 0.25) throw new Error('Net session time (after breaks) must be at least 15 minutes.')

      const durationMin = Math.round(totalHours * 60) + breakData.reduce((s, b) => s + b.duration, 0)

      // ── Upload images ──
      let imageUrls: string[] | null = null
      if (imageFiles.length > 0) {
        const urls = await Promise.all(
          imageFiles.map((f) => SessionService.uploadSessionImage(f, user.id))
        )
        imageUrls = urls
      }

      return SessionService.createManualSession(
        user.id, date, startTs, endTs, totalHours, durationMin,
        journal || null, breakData, imageUrls
      )
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['allSessions'] })
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

  function useAverageBreaksHandler() {
    if (!avgBreaks || avgBreaks.length === 0) {
      toast('No past sessions with breaks to average from.', 'info')
      return
    }
    setBreaks(avgBreaks.map((b) => ({
      start: toInputTime(b.start),
      end: toInputTime(b.end),
    })))
    toast(`Filled with ${avgBreaks.length} average break${avgBreaks.length > 1 ? 's' : ''}`, 'success')
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
        <ArrowLeft size={16} /> <span>Back to Logs</span>
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
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        marginBottom: '1.25rem',
        marginTop: '0.75rem',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Session Rules</strong>
        <span>• Only <strong>1 session per day</strong> is allowed</span>
        <span>• Date cannot be in the future or more than 1 year ago</span>
        <span>• Session must be between <strong>15 minutes</strong> and <strong>16 hours</strong></span>
        <span>• Each break must be at least 5 minutes and fall within session hours</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Date + Time row */}
          <div className="grid-3-col" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem', gap: '1rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date *</label>
              <DatePicker value={date} onChange={setDate} />
              {date > todayStr && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <AlertCircle size={12} /> Cannot be a future date
                </span>
              )}
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

          {/* Use Average button */}
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
              width: '100%',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-border)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-light)' }}
          >
            <Sparkles size={16} /> Use Average Time
            {avgSchedule?.avgTotalHours ? ` (avg ${avgSchedule.avgTotalHours}h)` : ''}
          </button>

          {/* Live time validation hint */}
          {timeIn && timeOut && (() => {
            const [h1, m1] = timeIn.split(':').map(Number)
            const [h2, m2] = timeOut.split(':').map(Number)
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
            if (diff <= 0) return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                <AlertCircle size={14} /> Time Out must be after Time In.
              </div>
            )
            if (diff < 15) return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                <AlertCircle size={14} /> Session must be at least 15 minutes.
              </div>
            )
            if (diff > 16 * 60) return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                <AlertCircle size={14} /> Session exceeds 16 hours. Please verify your times.
              </div>
            )
            return null
          })()}

          {/* Total hours card */}
          {computedHours > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Hours</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{computedHours.toFixed(2)}h</span>
            </div>
          )}

          {/* Breaks + Images side by side */}
          <div className="grid-2-col">

            {/* Breaks */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: breaks.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Break Periods
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {avgBreaks && avgBreaks.length > 0 && (
                    <button type="button" onClick={useAverageBreaksHandler}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <Sparkles size={13} /> Avg
                    </button>
                  )}
                  <button type="button" onClick={addBreak}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 700 }}>
                    <Plus size={14} /> Add Break
                  </button>
                </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
