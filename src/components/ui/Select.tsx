import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: ReactNode
  triggerStyle?: React.CSSProperties
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  triggerStyle,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocused(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const isActive = focused || open

  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
    boxShadow: isActive ? '0 0 0 3px var(--accent-light)' : 'none',
    borderRadius: '0.5rem',
    padding: icon ? '0.75rem 2.25rem 0.75rem 2.5rem' : '0.75rem 2.25rem 0.75rem 1rem',
    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
    fontSize: '0.875rem',
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'border-color 150ms, box-shadow 150ms',
    fontFamily: 'inherit',
    outline: 'none',
    ...triggerStyle,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Left icon */}
      {icon && (
        <div
          style={{
            position: 'absolute',
            left: '0.875rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            pointerEvents: 'none',
            zIndex: 1,
            display: 'flex',
            transition: 'color 150ms',
          }}
        >
          {icon}
        </div>
      )}

      {/* Chevron right icon */}
      <div
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: `translateY(-50%) rotate(${open ? '180deg' : '0deg'})`,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          display: 'flex',
          transition: 'transform 200ms, color 150ms',
        }}
      >
        <ChevronDown size={15} />
      </div>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          setFocused(true)
        }}
        onBlur={() => {
          if (!open) setFocused(false)
        }}
        style={baseStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'select-in 120ms ease',
          }}
        >
          <style>{`
            @keyframes select-in {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Blank / placeholder option */}
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            onClick={() => { onChange(''); setOpen(false); setFocused(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '0.625rem 0.875rem',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              fontStyle: 'italic',
              textAlign: 'left',
              transition: 'background-color 100ms',
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {placeholder}
          </button>

          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setOpen(false); setFocused(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 600 : 400,
                  textAlign: 'left',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
