import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Plus, Pencil, Trash2, Loader2, UserCheck, Mail, Lock, User, Building2, GraduationCap, BookOpen, ShieldAlert } from 'lucide-react'
import AdminService from '../../services/adminService'
import type { AdminUserRow, CreateUserPayload, UpdateUserPayload } from '../../services/adminService'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { SkeletonCard } from '../../components/ui/Skeleton'
import Select from '../../components/ui/Select'

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

// ── Shared input styles ─────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.75rem 0.625rem 2.25rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--accent)'
  e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'var(--border)'
  e.target.style.boxShadow = 'none'
}

function FieldRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      {children}
    </div>
  )
}

function FieldLabel({ text }: { text: string }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}
    </label>
  )
}

// ── Create User Modal ────────────────────────────────────────────────
function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateUserPayload>({
    email: '', password: '', full_name: '', school: '', year_level: '', workplace: '',
  })

  const mutation = useMutation({
    mutationFn: () => AdminService.createUser(form),
    onSuccess: () => {
      toast('User created successfully', 'success')
      qc.invalidateQueries({ queryKey: ['admin-all-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user-summaries'] })
      onClose()
      setForm({ email: '', password: '', full_name: '', school: '', year_level: '', workplace: '' })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function set(field: keyof CreateUserPayload, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New User" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {/* Email */}
        <div>
          <FieldLabel text="Email" />
          <FieldRow icon={Mail}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              placeholder="user@example.com" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        {/* Password */}
        <div>
          <FieldLabel text="Password" />
          <FieldRow icon={Lock}>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
              placeholder="Minimum 6 characters" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        {/* Full Name */}
        <div>
          <FieldLabel text="Full Name" />
          <FieldRow icon={User}>
            <input type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
              placeholder="Juan dela Cruz" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        {/* School */}
        <div>
          <FieldLabel text="School" />
          <FieldRow icon={BookOpen}>
            <input type="text" value={form.school} onChange={(e) => set('school', e.target.value)}
              placeholder="School name" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        {/* Year Level */}
        <div>
          <FieldLabel text="Year Level" />
          <Select
            value={form.year_level}
            onChange={(v) => set('year_level', v)}
            options={YEAR_LEVELS.map((l) => ({ value: l, label: l }))}
            placeholder="Select year level"
          />
        </div>
        {/* Workplace */}
        <div>
          <FieldLabel text="Workplace / Company" />
          <FieldRow icon={Building2}>
            <input type="text" value={form.workplace} onChange={(e) => set('workplace', e.target.value)}
              placeholder="Company name" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.email || !form.password || !form.full_name}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
              color: 'white', backgroundColor: 'var(--accent)',
              opacity: mutation.isPending || !form.email || !form.password || !form.full_name ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            {mutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Create User
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Edit User Modal ──────────────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState<UpdateUserPayload>({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    school: user?.school ?? '',
    year_level: user?.year_level ?? '',
    workplace: user?.workplace ?? '',
  })

  const mutation = useMutation({
    mutationFn: () => AdminService.updateUser(user!.user_id, form),
    onSuccess: () => {
      toast('User updated', 'success')
      qc.invalidateQueries({ queryKey: ['admin-all-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user-summaries'] })
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function set(field: keyof UpdateUserPayload, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <Modal open={!!user} onClose={onClose} title="Edit User" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <FieldLabel text="Email" />
          <FieldRow icon={Mail}>
            <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)}
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        <div>
          <FieldLabel text="Full Name" />
          <FieldRow icon={User}>
            <input type="text" value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)}
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        <div>
          <FieldLabel text="School" />
          <FieldRow icon={BookOpen}>
            <input type="text" value={form.school ?? ''} onChange={(e) => set('school', e.target.value)}
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>
        <div>
          <FieldLabel text="Year Level" />
          <Select
            value={form.year_level ?? ''}
            onChange={(v) => set('year_level', v)}
            options={YEAR_LEVELS.map((l) => ({ value: l, label: l }))}
            placeholder="Select year level"
          />
        </div>
        <div>
          <FieldLabel text="Workplace / Company" />
          <FieldRow icon={Building2}>
            <input type="text" value={form.workplace ?? ''} onChange={(e) => set('workplace', e.target.value)}
              style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </FieldRow>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
              color: 'white', backgroundColor: 'var(--accent)',
              opacity: mutation.isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            {mutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Delete Confirm Modal ─────────────────────────────────────────────
function DeleteModal({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => AdminService.deleteUser(user!.user_id),
    onSuccess: () => {
      toast('User deleted', 'success')
      qc.invalidateQueries({ queryKey: ['admin-all-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user-summaries'] })
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Modal open={!!user} onClose={onClose} title="Delete User" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', backgroundColor: 'rgba(242,63,66,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(242,63,66,0.25)' }}>
          <ShieldAlert size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              This action cannot be undone.
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <strong>{user?.full_name}</strong> ({user?.email}) and all their data will be permanently deleted.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
              color: 'white', backgroundColor: 'var(--error)',
              opacity: mutation.isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            {mutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Delete User
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2 } } }

export default function AdminUsersPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => AdminService.getAllUsers(),
  })

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Users size={20} color="var(--accent)" />
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              User Management
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            Create, edit, and remove trainee accounts.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
            color: 'white', backgroundColor: 'var(--accent)',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)' }}
        >
          <Plus size={16} />
          New User
        </button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        style={cardStyle}
      >
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <UserCheck size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No users yet. Create one to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'School', 'Year', 'Workplace', 'Role', 'Actions'].map((h) => (
                    <th key={h} style={{
                      padding: '0.625rem 1rem', textAlign: 'left',
                      fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="hidden" animate="visible">
                {users.map((u: AdminUserRow) => (
                  <motion.tr
                    key={u.user_id}
                    variants={itemVariants}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                  >
                    {/* Name */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: 'var(--accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.625rem', fontWeight: 700, color: 'white',
                          flexShrink: 0, overflow: 'hidden',
                        }}>
                          {u.profile_picture_url
                            ? <img src={u.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : u.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </td>
                    {/* School */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{u.school || '—'}</td>
                    {/* Year */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{u.year_level || '—'}</td>
                    {/* Workplace */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{u.workplace || '—'}</td>
                    {/* Role */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700,
                        backgroundColor: u.role === 'admin' ? 'var(--accent-light)' : 'rgba(35,165,90,0.12)',
                        color: u.role === 'admin' ? 'var(--accent)' : 'var(--success)',
                        border: `1px solid ${u.role === 'admin' ? 'var(--accent-border)' : 'rgba(35,165,90,0.3)'}`,
                        textTransform: 'capitalize',
                      }}>
                        {u.role === 'admin' ? <GraduationCap size={10} /> : <UserCheck size={10} />}
                        {u.role}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          onClick={() => setEditUser(u)}
                          title="Edit"
                          style={{
                            padding: '0.375rem', borderRadius: '0.375rem', color: 'var(--text-muted)',
                            transition: 'color 150ms, background-color 150ms',
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement
                            el.style.color = 'var(--accent)'
                            el.style.backgroundColor = 'var(--accent-light)'
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLElement
                            el.style.color = 'var(--text-muted)'
                            el.style.backgroundColor = 'transparent'
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteUser(u)}
                          title="Delete"
                          style={{
                            padding: '0.375rem', borderRadius: '0.375rem', color: 'var(--text-muted)',
                            transition: 'color 150ms, background-color 150ms',
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement
                            el.style.color = 'var(--error)'
                            el.style.backgroundColor = 'rgba(242,63,66,0.08)'
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLElement
                            el.style.color = 'var(--text-muted)'
                            el.style.backgroundColor = 'transparent'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal user={editUser} onClose={() => setEditUser(null)} />
      <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
