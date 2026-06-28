export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0, overflow: 'hidden' }}>
      <div className="skeleton" style={{ height: '160px', borderRadius: '1rem 1rem 0 0' }} />
      <div style={{ padding: '0.875rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="skeleton" style={{ height: '0.9375rem', width: '75%', borderRadius: '0.375rem' }} />
        <div className="skeleton" style={{ height: '0.8125rem', width: '45%', borderRadius: '0.375rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <div className="skeleton" style={{ height: '1.125rem', width: '35%', borderRadius: '0.375rem' }} />
          <div className="skeleton" style={{ height: '1.125rem', width: '28%', borderRadius: '999px' }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonLine({ width = '100%', height = '1rem' }) {
  return (
    <div className="skeleton" style={{ height, width, borderRadius: '0.375rem' }} />
  )
}

export function SkeletonText({ lines = 3 }) {
  const widths = ['100%', '85%', '60%']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  )
}
