import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, ChevronDown, ChevronUp, X, Check } from 'lucide-react'

function to12h(h24: number): { hour: number; period: 'AM' | 'PM' } {
  if (h24 === 0) return { hour: 12, period: 'AM' }
  if (h24 < 12) return { hour: h24, period: 'AM' }
  if (h24 === 12) return { hour: 12, period: 'PM' }
  return { hour: h24 - 12, period: 'PM' }
}

function to24h(h12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return h12 === 12 ? 0 : h12
  return h12 === 12 ? 12 : h12 + 12
}

interface TimePickerProps {
  value: string // "HH:MM" 24-hour
  onChange: (v: string) => void
  placeholder?: string
  triggerStyle?: React.CSSProperties
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  triggerStyle,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState(8)
  const [minute, setMinute] = useState(0)
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM')
  // Separate string states for direct typing
  const [hourStr, setHourStr] = useState('8')
  const [minStr, setMinStr] = useState('00')

  function openPicker() {
    if (value) {
      const parts = value.split(':')
      const h24 = parseInt(parts[0] ?? '8')
      const m = parseInt(parts[1] ?? '0')
      const { hour: h12, period: pd } = to12h(isNaN(h24) ? 8 : h24)
      const safeM = isNaN(m) ? 0 : m
      setHour(h12); setHourStr(h12.toString())
      setMinute(safeM); setMinStr(safeM.toString().padStart(2, '0'))
      setPeriod(pd)
    } else {
      setHour(8); setHourStr('8')
      setMinute(0); setMinStr('00')
      setPeriod('AM')
    }
    setOpen(true)
  }

  // Chevron handlers keep both states in sync
  function changeHour(next: number) { setHour(next); setHourStr(next.toString()) }
  function changeMinute(next: number) { setMinute(next); setMinStr(next.toString().padStart(2, '0')) }

  // Direct input handlers
  function onHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
    setHourStr(raw)
    const v = parseInt(raw)
    if (!isNaN(v) && v >= 1 && v <= 12) setHour(v)
  }
  function onHourBlur() {
    const v = parseInt(hourStr)
    const clamped = isNaN(v) ? 12 : Math.min(12, Math.max(1, v))
    setHour(clamped); setHourStr(clamped.toString())
  }
  function onMinuteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
    setMinStr(raw)
    const v = parseInt(raw)
    if (!isNaN(v) && v >= 0 && v <= 59) setMinute(v)
  }
  function onMinuteBlur() {
    const v = parseInt(minStr)
    const clamped = isNaN(v) ? 0 : Math.min(59, Math.max(0, v))
    setMinute(clamped); setMinStr(clamped.toString().padStart(2, '0'))
  }

  function confirm() {
    const h24 = to24h(hour, period)
    onChange(`${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
    setOpen(false)
  }

  const displayValue = value
    ? (() => {
        const parts = value.split(':')
        const h24 = parseInt(parts[0] ?? '0')
        const m = parseInt(parts[1] ?? '0')
        const { hour: h12, period: pd } = to12h(isNaN(h24) ? 0 : h24)
        return `${h12}:${(isNaN(m) ? 0 : m).toString().padStart(2, '0')} ${pd}`
      })()
    : ''

  const chevronBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '44px', height: '56px', borderRadius: '0.5rem',
    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', flexShrink: 0, cursor: 'pointer',
    transition: 'background-color 120ms, color 120ms',
  }

  const numInput: React.CSSProperties = {
    flex: 1, textAlign: 'center',
    fontSize: '2.25rem', fontWeight: 800,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-primary)',
    border: '2px solid var(--accent)',
    borderRadius: '0.5rem',
    padding: '0.25rem 0',
    outline: 'none',
    width: '100%',
    lineHeight: 1.4,
    caretColor: 'var(--accent)',
  }

  return (
    <>
      <div className="input-icon-wrapper">
        <Clock size={15} className="input-icon" style={{ pointerEvents: 'none' }} />
        <button
          type="button"
          onClick={openPicker}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem 0.75rem 2.5rem',
            color: value ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '0.9375rem',
            outline: 'none',
            width: '100%',
            transition: 'border-color 150ms, box-shadow 150ms',
            textAlign: 'left',
            cursor: 'pointer',
            boxShadow: open ? '0 0 0 3px var(--accent-light)' : 'none',
            ...triggerStyle,
          }}
        >
          {displayValue || placeholder}
        </button>
      </div>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '1rem',
              padding: '1.5rem',
              width: '300px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>Select Time</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* HOUR */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hour</div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
                <button type="button" onClick={() => changeHour(hour === 1 ? 12 : hour - 1)} style={chevronBtn}>
                  <ChevronDown size={22} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={hourStr}
                  onChange={onHourChange}
                  onBlur={onHourBlur}
                  onFocus={(e) => e.target.select()}
                  style={numInput}
                />
                <button type="button" onClick={() => changeHour(hour === 12 ? 1 : hour + 1)} style={chevronBtn}>
                  <ChevronUp size={22} />
                </button>
              </div>
            </div>

            {/* MINUTE */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Minute</div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
                <button type="button" onClick={() => changeMinute(minute === 0 ? 59 : minute - 1)} style={chevronBtn}>
                  <ChevronDown size={22} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minStr}
                  onChange={onMinuteChange}
                  onBlur={onMinuteBlur}
                  onFocus={(e) => e.target.select()}
                  style={numInput}
                />
                <button type="button" onClick={() => changeMinute(minute === 59 ? 0 : minute + 1)} style={chevronBtn}>
                  <ChevronUp size={22} />
                </button>
              </div>
            </div>

            {/* PERIOD */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '0.625rem', borderRadius: '0.5rem',
                      fontWeight: 700, fontSize: '0.9375rem',
                      backgroundColor: period === p ? 'var(--accent)' : 'var(--bg-primary)',
                      color: period === p ? 'white' : 'var(--text-secondary)',
                      border: period === p ? '2px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'background-color 150ms, color 150ms',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected preview */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.5rem', padding: '0.875rem', textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                <Check size={12} /> Selected
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
                {hour}:{minute.toString().padStart(2, '0')} {period}
              </div>
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={confirm}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}
            >
              <Check size={16} /> Confirm Time
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ width: '100%', padding: '0.625rem', color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', cursor: 'pointer' }}
            >
              <X size={14} /> Cancel
            </button>
          </motion.div>
        </div>
      )}
    </>
  )
}
