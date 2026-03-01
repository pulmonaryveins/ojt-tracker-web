import { useState, type FormEvent, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { Profile, OjtSetup } from '../types/database'

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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Profile state
  const [fullName, setFullName] = useState('')
  const [school, setSchool] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [workplace, setWorkplace] = useState('')
  const [profileMsg, setProfileMsg] = useState('')

  // OJT Setup state
  const [requiredHours, setRequiredHours] = useState('')
  const [ojtStart, setOjtStart] = useState('')
  const [ojtEnd, setOjtEnd] = useState('')
  const [ojtMsg, setOjtMsg] = useState('')

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      return data as Profile | null
    },
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
    if (profile) {
      setFullName(profile.full_name ?? '')
      setSchool(profile.school ?? '')
      setYearLevel(profile.year_level ?? '')
      setWorkplace(profile.workplace ?? '')
    }
  }, [profile])

  useEffect(() => {
    if (ojtSetup) {
      setRequiredHours(ojtSetup.required_hours?.toString() ?? '')
      setOjtStart(ojtSetup.start_date ?? '')
      setOjtEnd(ojtSetup.end_date ?? '')
    }
  }, [ojtSetup])

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async () => {
      const updates = { full_name: fullName, school, year_level: yearLevel, workplace }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = profile
        ? await supabase.from('profiles').update(updates as any).eq('user_id', userId)
        : await supabase.from('profiles').insert({ user_id: userId, ...updates, profile_picture_url: null } as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      setProfileMsg('Profile saved!')
      setTimeout(() => setProfileMsg(''), 3000)
    },
    onError: (err: Error) => setProfileMsg(`Error: ${err.message}`),
  })

  const { mutate: saveOjt, isPending: savingOjt } = useMutation({
    mutationFn: async () => {
      const ojtData = { user_id: userId, required_hours: parseFloat(requiredHours), start_date: ojtStart, end_date: ojtEnd }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = ojtSetup
        ? await supabase.from('ojt_setup').update(ojtData as any).eq('user_id', userId)
        : await supabase.from('ojt_setup').insert(ojtData as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ojtSetup', userId] })
      setOjtMsg('OJT setup saved!')
      setTimeout(() => setOjtMsg(''), 3000)
    },
    onError: (err: Error) => setOjtMsg(`Error: ${err.message}`),
  })

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwMsg('')

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
    } else {
      setPwMsg('Password updated!')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwMsg(''), 3000)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const displayName = fullName || user?.email || 'User'

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
          {getInitials(displayName)}
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{displayName}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.125rem 0 0' }}>{user?.email}</p>
        </div>
      </div>

      {/* Profile Info */}
      <SectionCard title="Profile Info">
        <form onSubmit={(e) => { e.preventDefault(); saveProfile() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Full Name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
            </FormField>
            <FormField label="Year Level">
              <input value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} placeholder="4th Year" style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
            </FormField>
          </div>
          <FormField label="School">
            <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="University of the Philippines" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          </FormField>
          <FormField label="Workplace / Company">
            <input value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="Acme Corp" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          </FormField>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" disabled={savingProfile}
              style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, opacity: savingProfile ? 0.7 : 1 }}>
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
            {profileMsg && <span style={{ fontSize: '0.875rem', color: profileMsg.startsWith('Error') ? 'var(--error)' : 'var(--success)' }}>{profileMsg}</span>}
          </div>
        </form>
      </SectionCard>

      {/* OJT Setup */}
      <SectionCard title="OJT Setup">
        <form onSubmit={(e) => { e.preventDefault(); saveOjt() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <FormField label="Required Hours">
            <input type="number" min="0" step="0.5" value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)} placeholder="480" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Start Date">
              <input type="date" value={ojtStart} onChange={(e) => setOjtStart(e.target.value)} style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
            </FormField>
            <FormField label="End Date">
              <input type="date" value={ojtEnd} onChange={(e) => setOjtEnd(e.target.value)} style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
            </FormField>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit" disabled={savingOjt}
              style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, opacity: savingOjt ? 0.7 : 1 }}>
              {savingOjt ? 'Saving…' : 'Save Setup'}
            </button>
            {ojtMsg && <span style={{ fontSize: '0.875rem', color: ojtMsg.startsWith('Error') ? 'var(--error)' : 'var(--success)' }}>{ojtMsg}</span>}
          </div>
        </form>
      </SectionCard>

      {/* Change Password */}
      <SectionCard title="Change Password">
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pwError && <div style={{ backgroundColor: 'rgba(242,63,66,0.1)', border: '1px solid var(--error)', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', color: 'var(--error)', fontSize: '0.875rem' }}>{pwError}</div>}
          <FormField label="New Password">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          </FormField>
          <FormField label="Confirm Password">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }} />
          </FormField>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button type="submit"
              style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600 }}>
              Update Password
            </button>
            {pwMsg && <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>{pwMsg}</span>}
          </div>
        </form>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard title="Account">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0, fontSize: '0.9375rem' }}>Sign out</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0.125rem 0 0' }}>Sign out of your OJT Tracker account.</p>
          </div>
          <button onClick={handleLogout}
            style={{ backgroundColor: 'rgba(218,55,60,0.15)', color: 'var(--error)', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, border: '1px solid rgba(218,55,60,0.3)' }}>
            Sign Out
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
