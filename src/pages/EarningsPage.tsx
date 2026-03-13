import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  DollarSign, TrendingUp, Wallet, CalendarDays, Check, Loader2,
  ChevronDown, ChevronUp, X, Banknote,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import SessionService from '../services/sessionService'
import { formatHours } from '../utils/timeUtils'
import { DatePicker } from '../components/ui/DatePicker'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'
import type { PaySetup, OjtSetup } from '../types/database'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD']
const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export default function EarningsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [hourlyRate, setHourlyRate] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const { data: paySetup, isLoading: loadingPay } = useQuery({
    queryKey: ['paySetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('pay_setup').select('*').eq('user_id', userId).single()
      return data as PaySetup | null
    },
    enabled: !!userId,
  })

  const { data: totalHours = 0 } = useQuery({
    queryKey: ['totalHours', userId],
    queryFn: () => SessionService.getTotalHours(userId),
    enabled: !!userId,
  })

  const { data: sessionsResult } = useQuery({
    queryKey: ['earningsSessions', userId],
    queryFn: () => SessionService.getSessionsWithBreaks(userId, 200, 0),
    enabled: !!userId,
  })

  const { data: ojtSetup } = useQuery({
    queryKey: ['ojtSetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('ojt_setup').select('*').eq('user_id', userId).single()
      return data as OjtSetup | null
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (paySetup) {
      setHourlyRate(paySetup.hourly_rate?.toString() ?? '')
      setCurrency(paySetup.currency ?? 'PHP')
      setEffectiveDate(paySetup.effective_date ?? '')
    }
  }, [paySetup])

  const { mutate: savePay, isPending: savingPay } = useMutation({
    mutationFn: async () => {
      const rate = parseFloat(hourlyRate)
      if (isNaN(rate) || rate <= 0) throw new Error('Please enter a valid hourly rate.')
      const payData = {
        user_id: userId,
        is_enabled: true,
        hourly_rate: rate,
        currency,
        effective_date: effectiveDate || null,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = paySetup
        ? await supabase.from('pay_setup').update(payData as any).eq('user_id', userId)
        : await supabase.from('pay_setup').insert(payData as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paySetup', userId] })
      setShowSettings(false)
      toast(paySetup ? 'Pay settings updated!' : 'Pay tracking enabled!', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const { mutate: disablePay, isPending: disablingPay } = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('pay_setup').update({ is_enabled: false } as any).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paySetup', userId] })
      setShowSettings(false)
      toast('Pay tracking disabled.', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const sessions = sessionsResult?.data ?? []
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const thisMonthHours = sessions
    .filter((s) => s.date >= monthStart && s.date <= monthEnd)
    .reduce((sum, s) => sum + s.total_hours, 0)

  const isEnabled = !!paySetup?.is_enabled
  const rate = isEnabled ? (paySetup?.hourly_rate ?? 0) : 0
  const curr = paySetup?.currency ?? currency
  const totalEarned = totalHours * rate
  const thisMonthEarned = thisMonthHours * rate
  const remainingHours = Math.max(0, (ojtSetup?.required_hours ?? 0) - totalHours)
  const projectedEarned = remainingHours * rate

  const inputBase: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
    transition: 'border-color 150ms, box-shadow 150ms',
    fontFamily: 'inherit',
  }
  const selectBase: React.CSSProperties = {
    ...inputBase,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2380848e' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2.5rem',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  if (loadingPay) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SkeletonCard lines={5} />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <style>{spinStyle}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <DollarSign size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Earnings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Track your estimated pay based on logged OJT hours
          </p>
        </div>
      </div>

      {!isEnabled ? (
        /* ── Setup Card (not enabled) ── */
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {/* Hero */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)',
            borderBottom: '1px solid var(--border)',
            padding: '2rem 1.5rem',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '1rem',
              backgroundColor: 'var(--accent)', margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px var(--accent-border)',
            }}>
              <Banknote size={30} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
              Track Your Earnings
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: '0 auto', maxWidth: '380px', lineHeight: 1.6 }}>
              Set your hourly rate and automatically estimate your earnings from logged OJT hours. Completely optional — turn it on or off anytime.
            </p>
          </div>

          {/* Setup Form */}
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={(e) => { e.preventDefault(); savePay() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                    Hourly Rate
                  </label>
                  <div className="input-icon-wrapper">
                    <DollarSign size={15} className="input-icon" />
                    <input
                      type="number" min="0" step="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="e.g. 75.00"
                      style={inputBase}
                      onFocus={onFocus} onBlur={onBlur}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                    Currency
                  </label>
                  <div className="input-icon-wrapper">
                    <Wallet size={15} className="input-icon" />
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                      style={selectBase} onFocus={onFocus} onBlur={onBlur}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                  Effective Date{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <DatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
              </div>

              <button
                type="submit"
                disabled={savingPay}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  backgroundColor: 'var(--accent)', color: 'white',
                  padding: '0.8125rem', borderRadius: '0.5rem',
                  fontWeight: 700, fontSize: '0.9375rem',
                  opacity: savingPay ? 0.75 : 1, transition: 'opacity 150ms',
                }}
              >
                {savingPay
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Enabling…</>
                  : <><Check size={16} /> Enable Pay Tracking</>}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Earnings Dashboard (enabled) ── */
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Earned', value: formatCurrency(totalEarned, curr), icon: DollarSign, color: 'var(--success)' },
              { label: 'This Month', value: formatCurrency(thisMonthEarned, curr), icon: CalendarDays, color: 'var(--accent)' },
              { label: 'Projected', value: formatCurrency(projectedEarned, curr), icon: TrendingUp, color: 'var(--warning)', hint: 'based on remaining OJT hours' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '0.5rem', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Rate Info Badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent-border)',
            borderRadius: '0.5rem', padding: '0.625rem 1rem',
          }}>
            <DollarSign size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Rate: <strong style={{ color: 'var(--accent)' }}>{formatCurrency(rate, curr)}/hr</strong>
              {' · '}{formatHours(totalHours)} logged
              {paySetup?.effective_date && (
                <> · Effective {format(new Date(paySetup.effective_date + 'T00:00:00'), 'MMM d, yyyy')}</>
              )}
            </span>
          </div>

          {/* Session Earnings Breakdown */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Session Earnings Breakdown</h2>
            </div>
            {sessions.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No sessions logged yet. Start logging sessions to see earnings here.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-modifier)' }}>
                      {['Date', 'Hours', 'Earnings', 'Notes'].map((h) => (
                        <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session, i) => (
                      <tr key={session.id} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-modifier)', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {format(new Date(session.date + 'T00:00:00'), 'MMM d, yyyy')}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {formatHours(session.total_hours)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ backgroundColor: 'rgba(35,165,90,0.12)', color: 'var(--success)', borderRadius: '9999px', padding: '0.125rem 0.625rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {formatCurrency(session.total_hours * rate, curr)}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.journal ? session.journal.slice(0, 60) : (session.description ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pay Settings (collapsible) */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', cursor: 'pointer',
                borderBottom: showSettings ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Wallet size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pay Settings</span>
              </div>
              {showSettings
                ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>

            {showSettings && (
              <div style={{ padding: '1.25rem' }}>
                <form onSubmit={(e) => { e.preventDefault(); savePay() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                        Hourly Rate
                      </label>
                      <div className="input-icon-wrapper">
                        <DollarSign size={15} className="input-icon" />
                        <input
                          type="number" min="0" step="0.01"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          placeholder="e.g. 75.00"
                          style={inputBase}
                          onFocus={onFocus} onBlur={onBlur}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                        Currency
                      </label>
                      <div className="input-icon-wrapper">
                        <Wallet size={15} className="input-icon" />
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                          style={selectBase} onFocus={onFocus} onBlur={onBlur}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                      Effective Date{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                    </label>
                    <DatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      disabled={savingPay}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        backgroundColor: 'var(--accent)', color: 'white',
                        padding: '0.75rem', borderRadius: '0.5rem',
                        fontWeight: 700, fontSize: '0.9375rem',
                        opacity: savingPay ? 0.75 : 1, transition: 'opacity 150ms',
                      }}
                    >
                      {savingPay
                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                        : <><Check size={16} /> Save Changes</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => disablePay()}
                      disabled={disablingPay}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                        backgroundColor: 'rgba(218,55,60,0.1)', color: 'var(--error)',
                        border: '1px solid rgba(218,55,60,0.3)',
                        padding: '0.75rem 1.125rem', borderRadius: '0.5rem',
                        fontWeight: 600, fontSize: '0.875rem',
                        opacity: disablingPay ? 0.75 : 1, transition: 'opacity 150ms',
                      }}
                    >
                      <X size={15} /> Disable
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
