import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, MailCheck, Mail, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

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

      {/* Decorative blobs */}
      <div className="auth-blob" style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.07, pointerEvents: 'none',
      }} />
      <div className="auth-blob-2" style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.04, pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/icon.png"
            alt="OJT Tracker"
            style={{ width: '56px', height: '56px', borderRadius: '1rem', objectFit: 'cover', marginBottom: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
          />
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem', letterSpacing: '-0.02em' }}>
            OJT Tracker
          </h1>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}>
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: 'center', padding: '0.5rem 0' }}
            >
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '68px', height: '68px', borderRadius: '50%',
                backgroundColor: 'rgba(35,165,90,0.1)',
                border: '1px solid rgba(35,165,90,0.2)',
                marginBottom: '1.25rem',
              }}>
                <MailCheck size={32} style={{ color: 'var(--success)' }} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                Reset link sent!
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: '0 0 0.375rem' }}>
                We sent a password reset link to
              </p>
              <p style={{ color: 'var(--accent)', fontWeight: 600, margin: '0 0 1.25rem' }}>{email}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
                Check your inbox and follow the link to set a new password. The link expires in 24 hours.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.375rem', letterSpacing: '-0.02em' }}>
                  Forgot your password?
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Email address
                </label>
                <div className="input-icon-wrapper">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    style={inputBase}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-light)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: 'var(--accent)', color: 'white',
                  borderRadius: '0.625rem', padding: '0.875rem',
                  fontWeight: 700, fontSize: '0.9375rem', width: '100%',
                  opacity: loading ? 0.75 : 1,
                  transition: 'opacity 150ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                {loading
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                  : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
