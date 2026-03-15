import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Mail as MailIcon, User, GraduationCap, Building2, Lock, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Select from '../../components/ui/Select'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export default function SignupPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [school, setSchool] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          school,
          year_level: yearLevel,
          workplace: companyName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Best-effort insert — works when email confirmation is off (session exists immediately).
      // When email confirmation is required, this may fail due to RLS (no active session).
      // ProfilePage handles that case by reading user_metadata on first login.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        school,
        year_level: yearLevel,
        workplace: companyName,
        profile_picture_url: null,
      } as any, { onConflict: 'user_id' })
    }

    if (data.session) {
      setSession(data.session)
      navigate('/onboarding')
    } else {
      navigate('/login')
    }
    setLoading(false)
  }

  const inputBase: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.625rem',
    padding: '0.75rem 0.875rem 0.75rem 2.5rem',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    transition: 'border-color 150ms, box-shadow 150ms',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
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
        style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/icon.png"
            alt="OJT Tracker"
            style={{ display: 'block', width: '56px', height: '56px', borderRadius: '1rem', objectFit: 'cover', margin: '0 auto 0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem', letterSpacing: '-0.02em' }}>
            OJT Tracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Create your account to get started</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.75rem',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  backgroundColor: 'rgba(242,63,66,0.08)',
                  border: '1px solid rgba(242,63,66,0.25)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  color: 'var(--error)',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Row: Full Name + Year Level */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Full Name *
                </label>
                <div className="input-icon-wrapper">
                  <User size={13} className="input-icon" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                    placeholder="Juan Dela Cruz" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Year Level *
                </label>
                <Select
                  value={yearLevel}
                  onChange={setYearLevel}
                  placeholder="Select year"
                  icon={<BookOpen size={13} />}
                  options={YEAR_LEVELS.map((y) => ({ value: y, label: y }))}
                  triggerStyle={{ fontSize: '0.9rem', borderRadius: '0.625rem' }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email *
              </label>
              <div className="input-icon-wrapper">
                <MailIcon size={13} className="input-icon" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@example.com" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Row: School + Company */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  School *
                </label>
                <div className="input-icon-wrapper">
                  <GraduationCap size={13} className="input-icon" />
                  <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} required
                    placeholder="UP Diliman" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company *
                </label>
                <div className="input-icon-wrapper">
                  <Building2 size={13} className="input-icon" />
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                    placeholder="Acme Corp" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password *
              </label>
              <div className="input-icon-wrapper">
                <Lock size={13} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={6}
                  placeholder="At least 6 characters"
                  style={{ ...inputBase, padding: '0.75rem 2.75rem 0.75rem 2.5rem' }}
                  onFocus={onFocus} onBlur={onBlur}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: 'var(--accent)', color: 'white',
                borderRadius: '0.625rem', padding: '0.875rem',
                fontWeight: 700, fontSize: '0.9375rem', width: '100%',
                marginTop: '0.25rem', opacity: loading ? 0.75 : 1,
                transition: 'opacity 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating account…</>
                : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
