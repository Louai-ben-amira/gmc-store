/**
 * BlockRating - renders ■■■■□ style rating glyphs instead of star icons.
 * max: total blocks (default 5)
 */
export default function BlockRating({ value = 0, max = 5, className = '' }) {
  const filled = Math.round(value)
  return (
    <span
      className={`font-mono text-[11px] tracking-[0.15em] select-none ${className}`}
      title={`${value} / ${max}`}
    >
      {Array.from({ length: max }, (_, i) =>
        i < filled
          ? <span key={i} className="text-accent">■</span>
          : <span key={i} className="text-border-strong">□</span>
      )}
    </span>
  )
}
