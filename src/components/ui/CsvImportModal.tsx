import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { parseImportCSV, type ImportRow } from '../../utils/csvImport'
import { toTimeString, calcTotalHours } from '../../utils/timeUtils'
import SessionService from '../../services/sessionService'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from './Toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUERY_KEYS_TO_INVALIDATE = [
  'sessions', 'allSessions', 'sessionsMonth', 'totalHours',
  'daysCount', 'recentSessions', 'reportSessions', 'earningsSessions',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ row }: { row: ImportRow }) {
  if (row.status === 'ready') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        backgroundColor: 'rgba(35,165,90,0.12)', color: 'var(--success)',
        borderRadius: '9999px', padding: '0.125rem 0.5rem',
        fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        <CheckCircle size={10} /> Ready
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      backgroundColor: 'rgba(240,178,50,0.12)', color: 'var(--warning)',
      borderRadius: '9999px', padding: '0.125rem 0.5rem',
      fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <AlertCircle size={10} /> Skip
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'importing' | 'done'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  /** All dates that already have a session, to detect conflicts */
  existingDates: Set<string>
}

export function CsvImportModal({ open, onClose, userId, existingDates }: Props) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importResults, setImportResults] = useState<{ created: number; failed: number }>({ created: 0, failed: 0 })

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const readyRows  = rows.filter((r) => r.status === 'ready')
  const skippedRows = rows.filter((r) => r.status === 'skip')

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFatalError('Please select a .csv file.')
      return
    }
    setFileName(file.name)
    setFatalError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseImportCSV(text, existingDates, todayStr)

      if (result.fatalError) {
        setFatalError(result.fatalError)
        return
      }

      setRows(result.rows)
      setStep('preview')
    }
    reader.readAsText(file)
  }, [existingDates, todayStr])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (e.target) e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Import execution ───────────────────────────────────────────────────────

  async function runImport() {
    const toImport = readyRows
    setImportTotal(toImport.length)
    setImportProgress(0)
    setStep('importing')

    let created = 0
    let failed = 0

    for (const row of toImport) {
      try {
        const startTs = toTimeString(row.timeIn)
        const endTs   = toTimeString(row.timeOut)
        const totalHours = calcTotalHours(startTs, endTs, [])
        const durationMin = Math.round(totalHours * 60)

        await SessionService.createManualSession(
          userId,
          row.date,
          startTs,
          endTs,
          totalHours,
          durationMin,
          null,
          [],
          null,
        )
        created++
      } catch {
        failed++
      }
      setImportProgress((p) => p + 1)
    }

    // Invalidate all relevant caches
    for (const key of QUERY_KEYS_TO_INVALIDATE) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }

    setImportResults({ created, failed })
    setStep('done')

    if (created > 0) {
      toast(`Imported ${created} session${created !== 1 ? 's' : ''} successfully!`, 'success')
    }
    if (failed > 0) {
      toast(`${failed} session${failed !== 1 ? 's' : ''} failed to import.`, 'error')
    }
  }

  // ── Reset & close ──────────────────────────────────────────────────────────

  function handleClose() {
    onClose()
    // Defer reset so the exit animation isn't interrupted
    setTimeout(() => {
      setStep('upload')
      setRows([])
      setFileName('')
      setFatalError(null)
      setShowSkipped(false)
      setImportProgress(0)
    }, 300)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="csv-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={step === 'importing' ? undefined : handleClose}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', zIndex: 9000,
          }}
        >
          <motion.div
            key="csv-modal"
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
              maxWidth: '600px',
              maxHeight: 'calc(100dvh - 2rem)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '0.5rem',
                  backgroundColor: 'var(--accent-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Import from CSV
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    {step === 'upload'    && 'Select a CSV file to import sessions'}
                    {step === 'preview'   && fileName}
                    {step === 'importing' && `Importing ${importProgress} / ${importTotal}…`}
                    {step === 'done'      && `Done — ${importResults.created} imported`}
                  </p>
                </div>
              </div>
              {step !== 'importing' && (
                <button onClick={handleClose} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}>
                  <X size={18} />
                </button>
              )}
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

              {/* ── Step: Upload ── */}
              {step === 'upload' && (
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Format hint */}
                  <div style={{
                    backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent-border)',
                    borderRadius: '0.5rem', padding: '0.875rem 1rem',
                    fontSize: '0.8125rem', color: 'var(--text-secondary)',
                    display: 'flex', flexDirection: 'column', gap: '0.25rem',
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Required columns</strong>
                    <span>Your CSV must have <strong>Date</strong>, <strong>Time In</strong>, and <strong>Time Out</strong> headers.</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Accepted date format: YYYY-MM-DD or MM/DD/YYYY · Time: 9:01 AM / 17:33
                    </span>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: '0.75rem',
                      padding: '2.5rem 1.5rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                      cursor: 'pointer',
                      backgroundColor: isDragging ? 'var(--accent-light)' : 'transparent',
                      transition: 'border-color 150ms, background-color 150ms',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '0.75rem',
                      backgroundColor: isDragging ? 'var(--accent)' : 'var(--bg-modifier)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background-color 150ms',
                    }}>
                      <FileText size={22} style={{ color: isDragging ? 'white' : 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                        {isDragging ? 'Drop to import' : 'Drag & drop your CSV here'}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        or click to browse
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />

                  {fatalError && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                      backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)',
                      borderRadius: '0.5rem', padding: '0.75rem 1rem',
                      fontSize: '0.8125rem', color: 'var(--error)',
                    }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                      {fatalError}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step: Preview ── */}
              {step === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>

                  {/* Summary bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                    padding: '0.875rem 1.25rem',
                    backgroundColor: 'var(--bg-modifier)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--success)', fontWeight: 700 }}>
                      <CheckCircle size={14} /> {readyRows.length} ready
                    </span>
                    {skippedRows.length > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--warning)', fontWeight: 700 }}>
                        <AlertCircle size={14} /> {skippedRows.length} will be skipped
                      </span>
                    )}
                    {readyRows.length === 0 && (
                      <span style={{ color: 'var(--text-muted)' }}>No valid rows to import.</span>
                    )}
                  </div>

                  {/* Ready rows table */}
                  {readyRows.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: '400px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-modifier)' }}>
                            {['Date', 'Time In', 'Time Out', 'Hours', 'Status'].map((h) => (
                              <th key={h} style={{
                                padding: '0.5rem 1rem', textAlign: 'left',
                                fontSize: '0.6875rem', fontWeight: 700,
                                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {readyRows.map((row) => (
                            <tr key={`${row.date}-${row.line}`} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.5rem 1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {format(new Date(row.date + 'T00:00:00'), 'MMM d, yyyy')}
                              </td>
                              <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {formatTime(row.timeIn)}
                              </td>
                              <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {formatTime(row.timeOut)}
                              </td>
                              <td style={{ padding: '0.5rem 1rem' }}>
                                <span style={{
                                  backgroundColor: 'var(--accent-light)', color: 'var(--accent)',
                                  borderRadius: '9999px', padding: '0.125rem 0.5rem',
                                  fontSize: '0.75rem', fontWeight: 700,
                                }}>
                                  {row.totalHours.toFixed(2)}h
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem 1rem' }}>
                                <StatusBadge row={row} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Skipped rows (collapsible) */}
                  {skippedRows.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => setShowSkipped((v) => !v)}
                        style={{
                          width: '100%', padding: '0.625rem 1.25rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: '0.8125rem', fontWeight: 600, color: 'var(--warning)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <AlertCircle size={13} />
                          {skippedRows.length} row{skippedRows.length !== 1 ? 's' : ''} will be skipped
                        </span>
                        {showSkipped ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {showSkipped && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: '400px' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-modifier)' }}>
                                {['Line', 'Date', 'Reason'].map((h) => (
                                  <th key={h} style={{
                                    padding: '0.5rem 1rem', textAlign: 'left',
                                    fontSize: '0.6875rem', fontWeight: 700,
                                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                    borderBottom: '1px solid var(--border)',
                                  }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {skippedRows.map((row) => (
                                <tr key={`skip-${row.line}`} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    #{row.line}
                                  </td>
                                  <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    {row.date}
                                  </td>
                                  <td style={{ padding: '0.5rem 1rem', color: 'var(--warning)', fontSize: '0.75rem' }}>
                                    {row.reason}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step: Importing ── */}
              {step === 'importing' && (
                <div style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    backgroundColor: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Loader2 size={26} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem', fontSize: '1rem' }}>
                      Importing sessions…
                    </p>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
                      {importProgress} of {importTotal} completed
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', maxWidth: '320px', backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                    <motion.div
                      animate={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                      transition={{ ease: 'easeOut' }}
                      style={{ backgroundColor: 'var(--accent)', height: '100%', borderRadius: '9999px' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                    Please don't close this window
                  </p>
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* ── Step: Done ── */}
              {step === 'done' && (
                <div style={{ padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    backgroundColor: importResults.created > 0 ? 'rgba(35,165,90,0.12)' : 'rgba(240,178,50,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle size={28} style={{ color: importResults.created > 0 ? 'var(--success)' : 'var(--warning)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', fontSize: '1.0625rem' }}>
                      Import complete
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {importResults.created > 0 && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 700 }}>
                          ✓ {importResults.created} session{importResults.created !== 1 ? 's' : ''} created
                        </span>
                      )}
                      {importResults.failed > 0 && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--error)', fontWeight: 700 }}>
                          ✗ {importResults.failed} failed
                        </span>
                      )}
                      {skippedRows.length > 0 && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {skippedRows.length} skipped
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* ── Footer actions ── */}
            {(step === 'preview' || step === 'done') && (
              <div style={{
                display: 'flex', gap: '0.625rem', justifyContent: 'flex-end',
                padding: '1rem 1.25rem',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}>
                {step === 'preview' && (
                  <>
                    <button
                      onClick={() => { setStep('upload'); setRows([]); setFileName('') }}
                      style={{
                        padding: '0.625rem 1rem',
                        backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)', borderRadius: '0.5rem',
                        fontSize: '0.875rem', fontWeight: 600,
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={runImport}
                      disabled={readyRows.length === 0}
                      style={{
                        padding: '0.625rem 1.25rem',
                        backgroundColor: readyRows.length === 0 ? 'var(--bg-modifier)' : 'var(--accent)',
                        color: readyRows.length === 0 ? 'var(--text-muted)' : 'white',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem', fontWeight: 700,
                        opacity: readyRows.length === 0 ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        transition: 'opacity 150ms',
                      }}
                    >
                      <Upload size={15} />
                      Import {readyRows.length} Session{readyRows.length !== 1 ? 's' : ''}
                    </button>
                  </>
                )}
                {step === 'done' && (
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '0.625rem 1.5rem',
                      backgroundColor: 'var(--accent)', color: 'white',
                      borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700,
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format "HH:MM" to display as "h:MM AM/PM" */
function formatTime(hhmm: string): string {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}
