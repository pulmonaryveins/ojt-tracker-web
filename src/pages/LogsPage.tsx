import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import SessionService from '../services/sessionService'
import { formatTime12h, formatHours } from '../utils/timeUtils'
import { format } from 'date-fns'

const PAGE_SIZE = 10

export default function LogsPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const offset = page * PAGE_SIZE

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', userId, page],
    queryFn: () => SessionService.getSessions(userId, PAGE_SIZE, offset),
    enabled: !!userId,
  })

  const sessions = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filtered = search.trim()
    ? sessions.filter(
        (s) =>
          s.date.includes(search) ||
          (s.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : sessions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Session Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {total} session{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Link
          to="/logs/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            backgroundColor: 'var(--accent)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)' }}
        >
          <Plus size={16} /> New Session
        </Link>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by date or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '0.375rem',
            padding: '0.625rem 0.75rem 0.625rem 2.25rem',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Session list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {search ? 'No sessions match your search.' : 'No sessions yet.'}
          </p>
          {!search && (
            <Link to="/logs/new" style={{ display: 'inline-block', marginTop: '0.75rem', backgroundColor: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Log your first session
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((session) => (
            <Link
              key={session.id}
              to={`/logs/${session.id}`}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textDecoration: 'none',
                gap: '1rem',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                    {format(new Date(session.date + 'T00:00:00'), 'EEE, MMM d, yyyy')}
                  </span>
                  {!session.end_time && (
                    <span style={{ backgroundColor: 'rgba(35,165,90,0.15)', color: 'var(--success)', borderRadius: '9999px', padding: '0.125rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600 }}>
                      In Progress
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {formatTime12h(session.start_time)} – {formatTime12h(session.end_time)}
                </div>
                {session.description && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.description}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '9999px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {formatHours(session.total_hours)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-hover)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-hover)',
              color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              opacity: page >= totalPages - 1 ? 0.5 : 1,
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
