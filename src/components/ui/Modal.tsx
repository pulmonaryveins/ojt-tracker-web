import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = '440px' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9000,
          }}
        >
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {title && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border)',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
                <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}>
                  <X size={18} />
                </button>
              </div>
            )}
            <div style={{ padding: '1.25rem' }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmDanger?: boolean
  loading?: boolean
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmDanger = false, loading = false }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-primary)',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: confirmDanger ? '#da373c' : 'var(--accent)',
            color: 'white',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
