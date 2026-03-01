import { useState, type FormEvent, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, User, Briefcase, Clock, Calendar, Eye, EyeOff, Moon, Sun, Loader2, Check, GraduationCap, Lock, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { uploadToStorage } from '../lib/storage'
import SessionService from '../services/sessionService'
import type { Profile, OjtSetup } from '../types/database'
import { useThemeStore, ACCENT_COLORS, type AccentColor, applyTheme } from '../stores/themeStore'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'
import { format } from 'date-fns'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: '1.25rem' }}>{children}</div>
    </div>
  )
}

function FieldLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '0.375rem' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {text}
      </label>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>{hint}</p>}
    </div>
  )
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mode, accent, setMode, setAccent } = useThemeStore()

  const [fullName, setFullName] = useState('')
  const [school, setSchool] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [workplace, setWorkplace] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [requiredHours, setRequiredHours] = useState('')
  const [ojtStart, setOjtStart] = useState('')
  const [ojtEnd, setOjtEnd] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
      return data as Profile | null
    },
    enabled: !!userId,
  })

  const { data: ojtSetup, isLoading: loadingOjt } = useQuery({
    queryKey: ['ojtSetup', userId],
    queryFn: async () => {
      const { data } = await supabase.from('ojt_setup').select('*').eq('user_id', userId).single()
      return data as OjtSetup | null
    },
    enabled: !!userId,
  })

  const { data: totalHours = 0 } = useQuery({
    queryKey: ['totalHours', userId],
    queryFn: () => SessionService.getTotalHours(userId),
    enabled: !!userId,
  })

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setSchool(profile.school ?? '')
      setYearLevel(profile.year_level ?? '')
      setWorkplace(profile.workplace ?? '')
      if (profile.profile_picture_url) setAvatarPreview(profile.profile_picture_url)
    }
  }, [profile])

  useEffect(() => {
    if (ojtSetup) {
      setRequiredHours(ojtSetup.required_hours?.toString() ?? '')
      setOjtStart(ojtSetup.start_date ?? '')
      setOjtEnd(ojtSetup.end_date ?? '')
    }
  }, [ojtSetup])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile || !userId) return null
    const ext = avatarFile.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const url = await uploadToStorage('avatars', path, avatarFile, { upsert: true })
    return `${url}?t=${Date.now()}`
  }

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async () => {
      let pictureUrl = profile?.profile_picture_url ?? null
      if (avatarFile) pictureUrl = await uploadAvatar()
      const updates = { full_name: fullName, school, year_level: yearLevel, workplace, profile_picture_url: pictureUrl }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = profile
        ? await supabase.from('profiles').update(updates as any).eq('user_id', userId)
        : await supabase.from('profiles').insert({ user_id: userId, ...updates } as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      setAvatarFile(null)
      toast('Profile saved!', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const { mutate: saveOjt, isPending: savingOjt } = useMutation({
    mutationFn: async () => {
      const ojtData = { user_id: userId, required_hours: parseFloat(requiredHours), start_date: ojtStart, end_date: ojtEnd || null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = ojtSetup
        ? await supabase.from('ojt_setup').update(ojtData as any).eq('user_id', userId)
        : await supabase.from('ojt_setup').insert(ojtData as any)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ojtSetup', userId] })
      toast('OJT setup saved!', 'success')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast('Passwords do not match.', 'error'); return }
    if (newPassword.length < 6) { toast('Password must be at least 6 characters.', 'error'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Password updated successfully!', 'success')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

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

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  const displayName = fullName || user?.email || 'User'
  const requiredHoursNum = parseFloat(requiredHours) || ojtSetup?.required_hours || 0
  const progressPct = requiredHoursNum > 0 ? Math.min(100, (totalHours / requiredHoursNum) * 100) : 0

  const estimatedCompletion = (() => {
    if (!ojtSetup?.start_date || !ojtSetup?.required_hours) return null
    const daysNeeded = Math.ceil(ojtSetup.required_hours / 8)
    const endDate = new Date(ojtSetup.start_date + 'T00:00:00')
    endDate.setDate(endDate.getDate() + Math.ceil(daysNeeded * (7 / 5)))
    return format(endDate, 'MMM d, yyyy')
  })()

  const accentKeys = Object.keys(ACCENT_COLORS) as AccentColor[]
  const accentLabels: Record<AccentColor, string> = {
    blurple: 'Blurple', pink: 'Pink', red: 'Red', green: 'Green', yellow: 'Yellow', teal: 'Teal',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <style>{spinStyle}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <User size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Profile</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Manage your personal info, OJT setup, and preferences
          </p>
        </div>
      </div>

      {/* Profile Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
          <div style={{
            width: '88px', height: '88px', borderRadius: '50%',
            border: '3px solid var(--accent)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--accent)',
            fontSize: '1.625rem', fontWeight: 800, color: 'white',
          }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitials(displayName)}
          </div>
          <div style={{
            position: 'absolute', bottom: '0', right: '0',
            width: '28px', height: '28px', borderRadius: '50%',
            backgroundColor: 'var(--accent)', border: '2px solid var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Camera size={14} color="white" />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{displayName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.125rem 0 0' }}>{user?.email}</p>
        </div>
      </div>

      {/* OJT Progress */}
      {ojtSetup && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>OJT Progress</h2>
            <span style={{ marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>
              {progressPct.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {totalHours.toFixed(1)} of {requiredHoursNum} hours
          </div>
          <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '10px', overflow: 'hidden', marginBottom: '0.875rem' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                backgroundColor: progressPct >= 100 ? 'var(--success)' : 'var(--accent)',
                height: '100%',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      )}

      {/* Personal Information */}
      {loadingProfile ? (
        <SkeletonCard lines={5} />
      ) : (
        <SectionCard title="Personal Information" icon={<User size={16} />}>
          <form onSubmit={(e) => { e.preventDefault(); saveProfile() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <FieldLabel text="Full Name" hint="Your display name shown throughout the app" />
              <div className="input-icon-wrapper">
                <User size={15} className="input-icon" />
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz"
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <FieldLabel text="Year Level" />
                <div className="input-icon-wrapper">
                  <GraduationCap size={15} className="input-icon" />
                  <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}
                    style={{
                      ...inputBase,
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2380848e' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      paddingRight: '2.5rem',
                    }}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    <option value="">Select year</option>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel text="School" />
                <div className="input-icon-wrapper">
                  <GraduationCap size={15} className="input-icon" />
                  <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your university"
                    style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel text="OJT Workplace" hint="The company or organization where you're doing your OJT" />
              <div className="input-icon-wrapper">
                <Briefcase size={15} className="input-icon" />
                <input value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="Acme Corp"
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                backgroundColor: 'var(--accent)', color: 'white',
                padding: '0.75rem', borderRadius: '0.5rem',
                fontWeight: 700, fontSize: '0.9375rem',
                opacity: savingProfile ? 0.75 : 1, transition: 'opacity 150ms',
              }}
            >
              {savingProfile
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Check size={16} /> Save Profile</>}
            </button>
          </form>
        </SectionCard>
      )}

      {/* OJT Requirements */}
      {loadingOjt ? (
        <SkeletonCard lines={4} />
      ) : (
        <SectionCard title="OJT Requirements" icon={<Clock size={16} />}>
          <form onSubmit={(e) => { e.preventDefault(); saveOjt() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <FieldLabel text="Required OJT Hours" hint="Total number of hours required by your school or company" />
              <div className="input-icon-wrapper">
                <Clock size={15} className="input-icon" />
                <input type="number" min="0" step="0.5" value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)} placeholder="540"
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <div>
              <FieldLabel text="OJT Start Date" hint="The first official day of your on-the-job training" />
              <div className="input-icon-wrapper">
                <Calendar size={15} className="input-icon" />
                <input type="date" value={ojtStart} onChange={(e) => setOjtStart(e.target.value)}
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <div>
              <FieldLabel text="Expected End Date (Optional)" hint="Leave blank to auto-calculate based on your progress" />
              <div className="input-icon-wrapper">
                <Calendar size={15} className="input-icon" />
                <input type="date" value={ojtEnd} onChange={(e) => setOjtEnd(e.target.value)}
                  style={inputBase} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {estimatedCompletion && !ojtEnd && (
              <div style={{ backgroundColor: 'rgba(35,165,90,0.08)', border: '1px solid rgba(35,165,90,0.3)', borderRadius: '0.5rem', padding: '0.875rem' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Based on 8 hours/day, 5 days/week:
                </p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>
                  {estimatedCompletion}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={savingOjt}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                backgroundColor: 'var(--accent)', color: 'white',
                padding: '0.75rem', borderRadius: '0.5rem',
                fontWeight: 700, fontSize: '0.9375rem',
                opacity: savingOjt ? 0.75 : 1, transition: 'opacity 150ms',
              }}
            >
              {savingOjt
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Check size={16} /> Save Configuration</>}
            </button>
          </form>
        </SectionCard>
      )}

      {/* Change Password */}
      <SectionCard title="Change Password" icon={<Lock size={16} />}>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <FieldLabel text="New Password" />
            <div className="input-icon-wrapper">
              <Lock size={15} className="input-icon" />
              <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters" minLength={6}
                style={{ ...inputBase, paddingRight: '2.75rem' }} onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel text="Confirm Password" />
            <div className="input-icon-wrapper">
              <Lock size={15} className="input-icon" />
              <input type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                style={inputBase} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
          <button type="submit"
            style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.9375rem' }}>
            Update Password
          </button>
        </form>
      </SectionCard>

      {/* Preferences / Appearance */}
      <SectionCard title="Preferences" icon={<Sun size={16} />}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Theme Mode
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            {(['dark', 'light'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); applyTheme(m, undefined) }}
                style={{
                  padding: '0.75rem',
                  border: `2px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '0.625rem',
                  backgroundColor: mode === m ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  color: mode === m ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.875rem',
                  transition: 'all 150ms',
                }}
              >
                {m === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                {m === 'dark' ? 'Dark' : 'Light'}
                {mode === m && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Accent Color
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            {accentKeys.map((colorKey) => {
              const colorVal = ACCENT_COLORS[colorKey].main
              const isSelected = accent === colorKey
              return (
                <button
                  key={colorKey}
                  onClick={() => { setAccent(colorKey); applyTheme(undefined, colorKey) }}
                  style={{
                    padding: '0.625rem 0.75rem',
                    border: `2px solid ${isSelected ? colorVal : 'var(--border)'}`,
                    borderRadius: '0.625rem',
                    backgroundColor: isSelected ? `${colorVal}20` : 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    color: isSelected ? colorVal : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '0.8125rem',
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: colorVal, flexShrink: 0 }} />
                  {accentLabels[colorKey]}
                  {isSelected && <Check size={13} />}
                </button>
              )
            })}
          </div>
        </div>
      </SectionCard>

      {/* Account / Sign Out */}
      <SectionCard title="Account">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: 0, fontSize: '0.9375rem' }}>Sign out</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0.125rem 0 0' }}>Sign out of your OJT Tracker account.</p>
          </div>
          <button onClick={handleLogout}
            style={{ backgroundColor: 'rgba(218,55,60,0.12)', color: 'var(--error)', padding: '0.5rem 1.125rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, border: '1px solid rgba(218,55,60,0.3)' }}>
            Sign Out
          </button>
        </div>
      </SectionCard>
    </motion.div>
  )
}
