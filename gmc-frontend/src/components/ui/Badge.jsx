/**
 * Badge - bracketed monospace tag.
 * variant: 'accent' | 'urgent' | 'muted'
 *
 * Renders as: [LABEL]
 */
export default function Badge({ children, variant = 'muted', className = '' }) {
  const variants = {
    accent: 'bg-accent-dim border border-accent-border text-accent',
    urgent: 'bg-urgent-dim border border-urgent-border text-urgent',
    muted:  'bg-bg-elevated border border-border-strong text-text-muted',
  }
  return (
    <span className={`inline-flex items-center font-mono text-[10px] font-bold tracking-[0.05em] uppercase px-2 py-0.5 rounded ${variants[variant]} ${className}`}>
      [{children}]
    </span>
  )
}
