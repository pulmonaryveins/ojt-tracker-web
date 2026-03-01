import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    padding: '0.625rem 0.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  } as const

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Insert initial profile row
    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
        school: '',
        year_level: '',
        workplace: '',
        profile_picture_url: null,
      } as any)
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Check your email</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem' }}>OJT Tracker</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Create your account</p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.75rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {[
              { label: 'Full Name', value: fullName, set: setFullName, type: 'text', placeholder: 'Juan Dela Cruz' },
              { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'you@example.com' },
              { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  required
                  placeholder={placeholder}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 1px var(--accent)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            ))}

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
                marginTop: '0.5rem',
                opacity: loading ? 0.7 : 1,
                transition: 'background-color 150ms',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
