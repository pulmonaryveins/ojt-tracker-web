import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Building2, Clock3, ChevronRight, Check, Sparkles } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { DatePicker } from '../components/ui/DatePicker'
import Select from '../components/ui/Select'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const userId = user?.id ?? ''

  // Step 1: Profile fields (pre-filled from signup metadata once user loads)
  const [school, setSchool] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [workplace, setWorkplace] = useState('')

  // Pre-fill from user_metadata once auth resolves
  useEffect(() => {
    if (user?.user_metadata) {
      const meta = user.user_metadata
      if (meta.school) setSchool(meta.school)
      if (meta.year_level) setYearLevel(meta.year_level)
      if (meta.workplace) setWorkplace(meta.workplace)
    }
  }, [user])

  // When user explicitly navigates here, clear the skip flag so the page is fully accessible
  useEffect(() => {
    if (userId) {
      localStorage.removeItem(`onboarding_done_${userId}`)
    }
  }, [userId])

  // Step 2: OJT setup
  const [requiredHours, setRequiredHours] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputBase: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem 0.75rem 2.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    outline: 'none',
    width: '100%',
    transition: 'border-color 150ms, box-shadow 150ms',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  async function handleStep1() {
    setError('')
    if (!school.trim() || !yearLevel || !workplace.trim()) {
      setError('Please fill in all fields.')
      return
    }
    if (!userId) {
      setError('Session expired. Please refresh and try again.')
      return
    }
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await supabase.from('profiles').upsert({
      user_id: userId,
      full_name: user?.user_metadata?.full_name ?? null,
      school,
      year_level: yearLevel,
      workplace,
      profile_picture_url: null,
    } as any, { onConflict: 'user_id' })
    setLoading(false)
    if (profileError) {
      setError(profileError.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    setStep(2)
  }

  async function handleStep2() {
    setError('')
    const hrs = parseFloat(requiredHours)
    if (!requiredHours || isNaN(hrs) || hrs <= 0) {
      setError('Enter a valid number of required hours.')
      return
    }
    if (!startDate) {
      setError('Please select a start date.')
      return
    }
    if (endDate && endDate <= startDate) {
      setError('End date must be after start date.')
      return
    }
    if (!userId) {
      setError('Session expired. Please refresh and try again.')
      return
    }
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await supabase.from('ojt_setup').upsert({
      user_id: userId,
      required_hours: hrs,
      start_date: startDate,
      end_date: endDate || null,
    } as any, { onConflict: 'user_id' })
    setLoading(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['ojtSetup', userId] })
    setStep(3)
  }

  function handleSkip() {
    // Mark as done so AppLayout doesn't redirect back
    localStorage.setItem(`onboarding_done_${userId}`, '1')
    navigate('/dashboard', { replace: true })
  }

  function handleFinish() {
    localStorage.setItem(`onboarding_done_${userId}`, '1')
    navigate('/dashboard', { replace: true })
  }

  const STEPS = [
    { num: 1, label: 'Profile' },
    { num: 2, label: 'OJT Setup' },
    { num: 3, label: 'Done' },
  ]

  // Wait for auth to hydrate before rendering
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-tertiary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{spinStyle}</style>

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
        width: '700px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, var(--accent) 0%, transparent 70%)',
        opacity: 0.06, pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/icon.png"
            alt="OJT Tracker"
            style={{ display: 'block', width: '56px', height: '56px', borderRadius: '1rem', objectFit: 'cover', margin: '0 auto 0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem', letterSpacing: '-0.02em' }}>
            Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Let&apos;s set up your account in just 2 steps
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', marginBottom: '1.75rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: step > s.num ? 'var(--success)' : step === s.num ? 'var(--accent)' : 'var(--bg-modifier)',
                  color: step >= s.num ? 'white' : 'var(--text-muted)',
                  fontSize: '0.8125rem', fontWeight: 700,
                  transition: 'all 300ms',
                }}>
                  {step > s.num ? <Check size={14} strokeWidth={3} /> : s.num}
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600,
                  color: step === s.num ? 'var(--accent)' : step > s.num ? 'var(--success)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: '64px', height: '2px', marginBottom: '18px', marginLeft: '4px', marginRight: '4px',
                  backgroundColor: step > s.num ? 'var(--success)' : 'var(--border)',
                  transition: 'background-color 300ms',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.75rem',
          overflow: 'hidden',
        }}>
          <AnimatePresence mode="wait">
            {/* ─── Step 1: Profile ─────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GraduationCap size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Your Profile</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Confirm your school and workplace details</p>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)', borderLeft: '3px solid var(--error)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {error}
                  </motion.div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>School *</label>
                    <div className="input-icon-wrapper">
                      <GraduationCap size={15} className="input-icon" />
                      <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} required
                        placeholder="University of the Philippines" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Year Level *</label>
                    <Select
                      value={yearLevel}
                      onChange={setYearLevel}
                      placeholder="Select year level"
                      icon={<GraduationCap size={15} />}
                      options={YEAR_LEVELS.map((y) => ({ value: y, label: y }))}
                      triggerStyle={{ fontSize: '0.9375rem', borderRadius: '0.625rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company / Workplace *</label>
                    <div className="input-icon-wrapper">
                      <Building2 size={15} className="input-icon" />
                      <input type="text" value={workplace} onChange={(e) => setWorkplace(e.target.value)} required
                        placeholder="Acme Corp" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: OJT Setup ───────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock3 size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>OJT Details</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Set your required hours and internship dates</p>
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ backgroundColor: 'rgba(242,63,66,0.08)', border: '1px solid rgba(242,63,66,0.25)', borderLeft: '3px solid var(--error)', borderRadius: '0.5rem', padding: '0.75rem 1rem', color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {error}
                  </motion.div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Required Hours *</label>
                    <div className="input-icon-wrapper">
                      <Clock3 size={15} className="input-icon" />
                      <input type="number" value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)}
                        required min={1} placeholder="e.g. 486"
                        style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                    </div>
                  </div>

                  <div className="onboarding-dates-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start Date *</label>
                      <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End Date</label>
                      <DatePicker value={endDate} onChange={setEndDate} placeholder="End date (optional)" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 3: Done ────────────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ textAlign: 'center', padding: '0.5rem 0' }}
              >
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '68px', height: '68px', borderRadius: '50%',
                  backgroundColor: 'rgba(35,165,90,0.1)',
                  border: '1px solid rgba(35,165,90,0.2)',
                  marginBottom: '1.25rem',
                }}>
                  <Sparkles size={30} style={{ color: 'var(--success)' }} />
                </div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                  You&apos;re all set!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
                  Your profile and OJT details have been saved. Start logging your sessions from the dashboard.
                </p>
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.625rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                }}>
                  {[
                    { label: 'School', value: school },
                    { label: 'Year Level', value: yearLevel },
                    { label: 'Company', value: workplace },
                    { label: 'Required Hours', value: `${requiredHours} hrs` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
          {step < 3 && (
            <button onClick={handleSkip}
              style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500, background: 'none', padding: '0.5rem' }}>
              Skip for now
            </button>
          )}

          {step === 1 && (
            <button onClick={handleStep1} disabled={loading}
              style={{
                backgroundColor: 'var(--accent)', color: 'white',
                borderRadius: '0.625rem', padding: '0.75rem 1.5rem',
                fontWeight: 700, fontSize: '0.9375rem', marginLeft: 'auto',
                opacity: loading ? 0.75 : 1,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
              Continue <ChevronRight size={16} />
            </button>
          )}

          {step === 2 && (
            <>
              <button onClick={() => { setError(''); setStep(1) }}
                style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, background: 'none', padding: '0.5rem' }}>
                ← Back
              </button>
              <button onClick={handleStep2} disabled={loading}
                style={{
                  backgroundColor: 'var(--accent)', color: 'white',
                  borderRadius: '0.625rem', padding: '0.75rem 1.5rem',
                  fontWeight: 700, fontSize: '0.9375rem',
                  opacity: loading ? 0.75 : 1,
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                Finish Setup <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 3 && (
            <button onClick={handleFinish}
              style={{
                backgroundColor: 'var(--accent)', color: 'white',
                borderRadius: '0.625rem', padding: '0.75rem 1.5rem',
                fontWeight: 700, fontSize: '0.9375rem', width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
              Go to Dashboard <ChevronRight size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
