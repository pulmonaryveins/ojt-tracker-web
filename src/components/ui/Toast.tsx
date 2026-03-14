import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertCircle, Info, X, type LucideProps } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastType, React.ComponentType<LucideProps>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
}

const colors: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: 'rgba(35,165,90,0.15)', text: 'var(--success)', border: 'rgba(35,165,90,0.4)' },
  error:   { bg: 'rgba(242,63,66,0.15)', text: 'var(--error)',   border: 'rgba(242,63,66,0.4)' },
  warning: { bg: 'rgba(240,178,50,0.15)', text: 'var(--warning)', border: 'rgba(240,178,50,0.4)' },
  info:    { bg: 'rgba(0,168,252,0.15)',  text: 'var(--info)',    border: 'rgba(0,168,252,0.4)' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <style>{`
        .toast-container {
          position: fixed;
          bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
          right: 1rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 360px;
          width: calc(100vw - 2rem);
          pointer-events: none;
        }
        @media (min-width: 768px) {
          .toast-container {
            bottom: 1.5rem;
            right: 1.5rem;
            width: 360px;
          }
        }
      `}</style>
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.type]
            const c = colors[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${c.border}`,
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto',
                }}
              >
                <Icon size={18} style={{ color: c.text, flexShrink: 0, marginTop: '1px' }} />
                <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.4 }}>{t.message}</span>
                <button
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  style={{ color: 'var(--text-muted)', flexShrink: 0, padding: '0 0 0 0.25rem' }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
