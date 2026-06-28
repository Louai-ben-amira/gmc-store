export default function TicketStub({ top, bottom, className = '' }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      overflow: 'hidden',
    }} className={className}>
      {/* Top section */}
      <div style={{ padding: '1rem 1.125rem 0.875rem' }}>
        {top}
      </div>

      {/* Dashed divider — full width, no margin */}
      <div style={{
        borderTop: '1px dashed var(--border-strong)',
        margin: '0 1.125rem',
        position: 'relative',
      }}>
        {/* Notch circles rendered as pure CSS — bleed left/right */}
        <span style={{
          position: 'absolute', left: -28, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-strong)',
          display: 'block',
        }} />
        <span style={{
          position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-strong)',
          display: 'block',
        }} />
      </div>

      {/* Bottom section */}
      <div style={{ padding: '0.875rem 1.125rem 1rem' }}>
        {bottom}
      </div>
    </div>
  )
}
