import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Eye, EyeOff, Loader2, Mail, User, GraduationCap, Building2, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [school, setSchool] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
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

    setSuccess(true)
    setLoading(false)
  }

  const inputBase: React.CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
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

  function Label({ text }: { text: string }) {
    return (
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {text}
      </label>
    )
  }

  if (success) {
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
        <div className="auth-blob" style={{
          position: 'absolute', top: '-10%', left: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.08, pointerEvents: 'none',
        }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '1rem',
            padding: '3rem 2rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative', zIndex: 1,
          }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(35,165,90,0.15)',
            marginBottom: '1.25rem',
          }}>
            <Mail size={32} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>Check your email</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: '0 0 0.5rem' }}>
            We sent a confirmation link to
          </p>
          <p style={{ color: 'var(--accent)', fontWeight: 600, margin: '0 0 1.75rem' }}>{email}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
            Click the link in the email to activate your account.
          </p>
          <Link to="/login" style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--accent)',
            color: 'white',
            borderRadius: '0.5rem',
            fontWeight: 700,
            fontSize: '0.9375rem',
          }}>
            Back to Sign In
          </Link>
        </motion.div>
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

      <div className="auth-blob" style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.08, pointerEvents: 'none',
      }} />
      <div className="auth-blob-2" style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--success) 0%, transparent 70%)',
        opacity: 0.05, pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '1.125rem',
            backgroundColor: 'var(--accent)', marginBottom: '1rem',
            boxShadow: '0 8px 24px var(--accent-border)',
          }}>
            <Clock size={30} color="white" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>Start tracking your OJT hours</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  backgroundColor: 'rgba(242,63,66,0.1)',
                  border: '1px solid rgba(242,63,66,0.4)',
                  borderLeft: '4px solid var(--error)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  color: 'var(--error)',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Full Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="Full Name *" />
              <div className="input-icon-wrapper">
                <User size={15} className="input-icon" />
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  placeholder="Juan Dela Cruz" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="Email *" />
              <div className="input-icon-wrapper">
                <Mail size={15} className="input-icon" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="you@example.com" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* School */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="School *" />
              <div className="input-icon-wrapper">
                <GraduationCap size={15} className="input-icon" />
                <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} required
                  placeholder="University of the Philippines" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Year Level */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="Year Level *" />
              <div className="input-icon-wrapper">
                <GraduationCap size={15} className="input-icon" />
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  required
                  style={{
                    ...inputBase,
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2380848e' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    paddingRight: '2.5rem',
                    cursor: 'pointer',
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  <option value="">Select year level</option>
                  {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Company Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="Company / Workplace *" />
              <div className="input-icon-wrapper">
                <Building2 size={15} className="input-icon" />
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                  placeholder="Acme Corp" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Label text="Password *" />
              <div className="input-icon-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  style={{ ...inputBase, paddingRight: '2.75rem' }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white',
                borderRadius: '0.5rem',
                padding: '0.8125rem',
                fontWeight: 700,
                fontSize: '0.9375rem',
                width: '100%',
                marginTop: '0.25rem',
                opacity: loading ? 0.75 : 1,
                transition: 'opacity 150ms',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
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
