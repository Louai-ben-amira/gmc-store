/**
 * Button - design-system button.
 * variant: 'primary' | 'secondary' | 'ghost'
 * confirm: adds '> ' prefix (purchase / confirm actions only)
 */
export default function Button({
  children,
  variant = 'primary',
  confirm = false,
  className = '',
  disabled,
  onClick,
  type = 'button',
  ...props
}) {
  const base = 'inline-flex items-center gap-2 font-display font-semibold rounded-lg transition-all whitespace-nowrap'

  const variants = {
    primary:   'bg-accent text-bg-base px-6 py-3 hover:opacity-85 active:scale-[0.98] disabled:opacity-40',
    secondary: 'bg-transparent border border-border-strong text-text-primary px-6 py-3 hover:border-accent hover:text-accent disabled:opacity-40',
    ghost:     'bg-transparent text-text-muted px-4 py-2 hover:bg-bg-elevated hover:text-text-primary disabled:opacity-40',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {confirm && <span aria-hidden>{'>'}</span>}
      {children}
    </button>
  )
}
