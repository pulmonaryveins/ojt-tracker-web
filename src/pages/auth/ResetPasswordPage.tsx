import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
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

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.5rem' }}>OJT Tracker</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Set a new password</p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.75rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {[
              { label: 'New Password', value: password, set: setPassword, placeholder: '••••••••' },
              { label: 'Confirm Password', value: confirm, set: setConfirm, placeholder: '••••••••' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
                <input
                  type="password"
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
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
