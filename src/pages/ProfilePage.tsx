import { useState, type FormEvent, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, User, Briefcase, Clock, Eye, EyeOff, Moon, Sun, Loader2, Check, GraduationCap, Lock, TrendingUp, LogOut } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { uploadToStorage } from '../lib/storage'
import SessionService from '../services/sessionService'
import type { Profile, OjtSetup } from '../types/database'
import { useThemeStore, ACCENT_COLORS, type AccentColor, applyTheme } from '../stores/themeStore'
import { useToast } from '../components/ui/Toast'
import { SkeletonCard } from '../components/ui/Skeleton'
import { DatePicker } from '../components/ui/DatePicker'
import Select from '../components/ui/Select'
import { format } from 'date-fns'

const spinStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`

type Tab = 'personal' | 'ojt' | 'preferences'

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function FieldLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '0.375rem' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {text}
      </label>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.125rem 0 0' }}>{hint}</p>}
    </div>
  )
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mode, accent, setMode, setAccent } = useThemeStore()

  const [activeTab, setActiveTab] = useState<Tab>('personal')

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
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
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

  // Auto-create profile from signup metadata when no profile exists yet
  useEffect(() => {
    if (!loadingProfile && profile === null && userId && user?.user_metadata) {
      const meta = user.user_metadata
      if (meta.full_name || meta.school || meta.workplace) {
        supabase.from('profiles')
          .upsert({
            user_id: userId,
            full_name: meta.full_name ?? null,
            school: meta.school ?? null,
            year_level: meta.year_level ?? null,
            workplace: meta.workplace ?? null,
            profile_picture_url: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (!error) queryClient.invalidateQueries({ queryKey: ['profile', userId] })
          })
      }
    }
  }, [loadingProfile, profile, userId, user, queryClient])

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
      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, ...updates } as any, { onConflict: 'user_id' })
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: 'Personal', icon: <User size={15} /> },
    { id: 'ojt', label: 'OJT Setup', icon: <Clock size={15} /> },
    { id: 'preferences', label: 'Preferences', icon: <Sun size={15} /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <style>{spinStyle}{`
        .profile-outer { display: flex; flex-direction: column; gap: 1.5rem; }
        .profile-side { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .profile-logout-mobile { display: none; }
        @media (max-width: 768px) {
          .profile-side { grid-template-columns: 1fr; }
          .profile-logout-mobile { display: flex; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '0.625rem',
          backgroundColor: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <User size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Profile</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>Manage your personal info, OJT setup, and preferences</p>
        </div>
      </div>

      <div className="profile-outer">

        {/* ── Top: profile card + OJT progress ── */}
        <div className="profile-side">

          {/* Profile card */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            textAlign: 'center',
          }}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                border: '2px solid var(--accent)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--accent)',
                fontSize: '1.5rem', fontWeight: 800, color: 'white',
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitials(displayName)}
              </div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '26px', height: '26px', borderRadius: '50%',
                backgroundColor: 'var(--accent)', border: '2px solid var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Camera size={13} color="white" />
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{displayName}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0.125rem 0 0' }}>{user?.email}</p>
            </div>
          </div>

          {/* OJT Progress card */}
          {ojtSetup && (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>OJT Progress</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>{progressPct.toFixed(1)}%</span>
              </div>
              <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '7px', overflow: 'hidden', marginBottom: '0.875rem' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ backgroundColor: progressPct >= 100 ? 'var(--success)' : 'var(--accent)', height: '100%', borderRadius: '9999px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Completed', value: `${totalHours.toFixed(1)} hrs` },
                  { label: 'Required', value: `${requiredHoursNum} hrs` },
                  { label: 'Remaining', value: `${Math.max(0, requiredHoursNum - totalHours).toFixed(1)} hrs` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Tabs + content ── */}
        <div className="profile-main">

          {/* Tab Bar */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '0.25rem',
            marginBottom: '1rem',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === tab.id ? 'var(--accent-light)' : 'transparent',
                  transition: 'all 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >

          {/* ── Personal Information Tab ── */}
          {activeTab === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingProfile ? <SkeletonCard lines={5} /> : (
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1.25rem' }}>
                    Personal Information
                  </h3>
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
                        <Select
                          value={yearLevel}
                          onChange={setYearLevel}
                          placeholder="Select year"
                          icon={<GraduationCap size={15} />}
                          options={['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => ({ value: y, label: y }))}
                        />
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
                        fontWeight: 600, fontSize: '0.875rem',
                        opacity: savingProfile ? 0.75 : 1, transition: 'opacity 150ms',
                      }}
                    >
                      {savingProfile
                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                        : <><Check size={15} /> Save Profile</>}
                    </button>
                  </form>
                </div>
              )}

              {/* Change Password */}
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1.25rem' }}>
                  Change Password
                </h3>
                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <FieldLabel text="New Password" />
                      <div className="input-icon-wrapper">
                        <Lock size={15} className="input-icon" />
                        <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 6 characters" minLength={6}
                          style={{ ...inputBase, paddingRight: '2.75rem' }} onFocus={onFocus} onBlur={onBlur} />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
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
                  </div>
                  <button type="submit"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      padding: '0.75rem', borderRadius: '0.5rem',
                      fontWeight: 600, fontSize: '0.875rem',
                    }}>
                    <Lock size={15} />
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── OJT Setup Tab ── */}
          {activeTab === 'ojt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Progress card */}
              {ojtSetup && (
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Progress</span>
                    </div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>{progressPct.toFixed(1)}%</span>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-modifier)', borderRadius: '9999px', height: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ backgroundColor: progressPct >= 100 ? 'var(--success)' : 'var(--accent)', height: '100%', borderRadius: '9999px' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    {[
                      { label: 'Completed', value: `${totalHours.toFixed(1)} hrs` },
                      { label: 'Required', value: `${requiredHoursNum} hrs` },
                      { label: 'Remaining', value: `${Math.max(0, requiredHoursNum - totalHours).toFixed(1)} hrs` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OJT Requirements form */}
              {loadingOjt ? <SkeletonCard lines={4} /> : (
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1.25rem' }}>
                    OJT Configuration
                  </h3>
                  <form onSubmit={(e) => { e.preventDefault(); saveOjt() }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <FieldLabel text="Required OJT Hours" hint="Total number of hours required by your school or company" />
                      <div className="input-icon-wrapper">
                        <Clock size={15} className="input-icon" />
                        <input type="number" min="0" step="0.5" value={requiredHours} onChange={(e) => setRequiredHours(e.target.value)} placeholder="540"
                          style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                      <div>
                        <FieldLabel text="OJT Start Date" />
                        <DatePicker value={ojtStart} onChange={setOjtStart} placeholder="Select start date" />
                      </div>
                      <div>
                        <FieldLabel text="Expected End Date"/>
                        <DatePicker value={ojtEnd} onChange={setOjtEnd} placeholder="Auto-calculate" />
                      </div>
                    </div>

                    {estimatedCompletion && !ojtEnd && (
                      <div style={{ backgroundColor: 'rgba(35,165,90,0.08)', border: '1px solid rgba(35,165,90,0.25)', borderRadius: '0.5rem', padding: '0.875rem' }}>
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Estimated completion (8 hrs/day, 5 days/week)</p>
                        <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>{estimatedCompletion}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingOjt}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        backgroundColor: 'var(--accent)', color: 'white',
                        padding: '0.75rem', borderRadius: '0.5rem',
                        fontWeight: 600, fontSize: '0.875rem',
                        opacity: savingOjt ? 0.75 : 1, transition: 'opacity 150ms',
                      }}
                    >
                      {savingOjt
                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                        : <><Check size={15} /> Save Configuration</>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── Preferences Tab ── */}
          {activeTab === 'preferences' && (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Theme Mode */}
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
                  Theme Mode
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {(['dark', 'light'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); applyTheme(m, undefined) }}
                      style={{
                        padding: '1rem',
                        border: `2px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '0.625rem',
                        backgroundColor: mode === m ? 'var(--accent-light)' : 'var(--bg-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        color: mode === m ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.875rem',
                        transition: 'all 150ms',
                      }}
                    >
                      {m === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                      {m === 'dark' ? 'Dark' : 'Light'}
                      {mode === m && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

              {/* Accent Color */}
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
                  Accent Color
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {accentKeys.map((colorKey) => {
                    const colorVal = ACCENT_COLORS[colorKey].main
                    const isSelected = accent === colorKey
                    return (
                      <button
                        key={colorKey}
                        onClick={() => { setAccent(colorKey); applyTheme(undefined, colorKey) }}
                        style={{
                          padding: '0.875rem 0.5rem',
                          border: `2px solid ${isSelected ? colorVal : 'var(--border)'}`,
                          borderRadius: '0.625rem',
                          backgroundColor: isSelected ? `${colorVal}18` : 'var(--bg-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          color: isSelected ? colorVal : 'var(--text-secondary)',
                          fontWeight: 600, fontSize: '0.8125rem',
                          transition: 'all 150ms',
                        }}
                      >
                        <div style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: colorVal, flexShrink: 0 }} />
                        {accentLabels[colorKey]}
                        {isSelected && <Check size={12} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

        </motion.div>
          </AnimatePresence>
        </div>



      </div>

      {/* Mobile-only logout button */}
      <button
        className="profile-logout-mobile"
        onClick={() => supabase.auth.signOut()}
        style={{
          marginTop: '0.5rem',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.875rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        <LogOut size={16} />
        Log Out
      </button>

    </motion.div>
  )
}
  