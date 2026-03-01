import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem' }}>OJT Tracker</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Reset your password</p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '2rem' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>Email sent!</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Check your inbox for a password reset link.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.75rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                Enter your email and we'll send you a link to reset your password.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.375rem',
                    padding: '0.625rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    width: '100%',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 1px var(--accent)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: loading ? 'var(--accent-hover)' : 'var(--accent)',
                  color: 'white',
                  borderRadius: '0.375rem',
                  padding: '0.625rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  width: '100%',
                  opacity: loading ? 0.7 : 1,
                  transition: 'background-color 150ms',
                }}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
