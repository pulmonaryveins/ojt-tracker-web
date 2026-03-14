import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Position the portal dropdown relative to the trigger button
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropHeight = Math.min(220, options.length * 40 + 44)
    const openAbove = spaceBelow < dropHeight + 8 && rect.top > dropHeight + 8

    setDropdownStyle({
      position: 'fixed',
      top: openAbove ? rect.top - dropHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(document.getElementById('select-portal-dropdown')?.contains(target))
      ) {
        setOpen(false)
        setFocused(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setFocused(false) }
    }
    function onScroll() {
      if (open && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setDropdownStyle((prev) => ({ ...prev, top: rect.bottom + 4, left: rect.left, width: rect.width }))
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
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

  const dropdown = (
    <div
      id="select-portal-dropdown"
      role="listbox"
      style={{
        ...dropdownStyle,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        maxHeight: '220px',
        overflowY: 'auto',
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
  )

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

      {/* Chevron icon */}
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
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen((prev) => !prev); setFocused(true) }}
        onBlur={() => { if (!open) setFocused(false) }}
        style={baseStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
      </button>

      {/* Dropdown rendered in portal to escape overflow:hidden parents */}
      {open && createPortal(dropdown, document.body)}
    </div>
  )
}
