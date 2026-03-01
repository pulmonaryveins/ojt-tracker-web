import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns'

interface DatePickerProps {
  value: string // "yyyy-MM-dd"
  onChange: (v: string) => void
  placeholder?: string
  triggerStyle?: React.CSSProperties
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  triggerStyle,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [selected, setSelected] = useState(value)

  function openPicker() {
    const initial = value ? new Date(value + 'T00:00:00') : new Date()
    setViewDate(initial)
    setSelected(value)
    setOpen(true)
  }

  function confirm() {
    if (selected) { onChange(selected); setOpen(false) }
  }

  const displayValue = value
    ? format(new Date(value + 'T00:00:00'), 'MMMM d, yyyy')
    : ''

  const selectedDisplay = selected
    ? format(new Date(selected + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
    : ''

  // Build calendar grid with leading empty cells
  const firstDay = startOfMonth(viewDate)
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(viewDate) })
  const calGrid: (Date | null)[] = [...Array(getDay(firstDay)).fill(null), ...days]
  while (calGrid.length % 7 !== 0) calGrid.push(null)

  const navBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', borderRadius: '0.375rem',
    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer',
    transition: 'background-color 120ms',
  }

  return (
    <>
      <div className="input-icon-wrapper">
        <Calendar size={15} className="input-icon" style={{ pointerEvents: 'none' }} />
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
              width: '320px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>Select Date</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))} style={navBtn}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))} style={navBtn}>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.25rem' }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '1rem' }}>
              {calGrid.map((day, i) => {
                if (!day) return <div key={`e${i}`} />
                const ds = format(day, 'yyyy-MM-dd')
                const isSel = ds === selected
                const isNow = isToday(day)
                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => setSelected(ds)}
                    style={{
                      textAlign: 'center',
                      padding: '0.4rem 0',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: isSel ? 700 : 400,
                      backgroundColor: isSel
                        ? 'var(--accent)'
                        : isNow ? 'var(--accent-light)' : 'transparent',
                      color: isSel
                        ? 'white'
                        : isNow ? 'var(--accent)' : 'var(--text-primary)',
                      border: isNow && !isSel ? '1px solid var(--accent-border)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color 100ms',
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Selected preview */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '0.5rem', padding: '0.875rem', textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                <Check size={12} /> Selected
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>
                {selectedDisplay || '—'}
              </div>
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={confirm}
              disabled={!selected}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: selected ? 'var(--accent)' : 'var(--bg-hover)', color: selected ? 'white' : 'var(--text-muted)', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: selected ? 'pointer' : 'not-allowed' }}
            >
              <Check size={16} /> Confirm Date
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
