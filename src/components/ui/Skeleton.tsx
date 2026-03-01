interface SkeletonProps {
  width?: string
  height?: string
  borderRadius?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '1rem', borderRadius = '0.375rem', style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, ...style }}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
    }}>
      <Skeleton height="1.125rem" width="60%" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} height="0.875rem" width={i % 2 === 0 ? '85%' : '70%'} />
      ))}
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
    }}>
      <Skeleton height="0.75rem" width="50%" />
      <Skeleton height="2rem" width="40%" />
    </div>
  )
}
