/**
 * AdminUI — shared design-system components for the GMC admin panel.
 *
 * Import what you need:
 *   import { Panel, PageHeader, StatusPill, DataTable, … } from '../../components/admin/AdminUI'
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS  (all admin-specific colours live here)
   ═══════════════════════════════════════════════════════════ */
export const T = {
  bgPage:        '#0A0512',
  bgPanel:       '#150C26',
  bgStrip:       '#130A20',
  bgInput:       '#0d0d18',
  border:        'rgba(139,79,219,0.22)',
  borderHover:   'rgba(155,79,237,0.5)',
  purple:        '#9B4FED',
  purpleText:    '#B57BFF',
  textPrimary:   '#FFFFFF',
  textMuted:     '#7A6A9E',
  textSub:       '#B3A4D4',
  success:       '#36FFC0',
  successDim:    'rgba(54,255,192,0.12)',
  successBorder: 'rgba(54,255,192,0.35)',
  warning:       '#FFC84D',
  warningDim:    'rgba(255,200,77,0.12)',
  warningBorder: 'rgba(255,200,77,0.35)',
  danger:        '#FF6B85',
  dangerDim:     'rgba(255,107,133,0.12)',
  dangerBorder:  'rgba(255,107,133,0.35)',
  info:          '#00CFFF',
  infoDim:       'rgba(0,207,255,0.12)',
  infoBorder:    'rgba(0,207,255,0.35)',
  mono:          "'JetBrains Mono', monospace",
  heading:       "'Rajdhani', sans-serif",
  body:          "'Outfit', sans-serif",
}

/* pill colour maps — keyed by semantic status string */
const PILL_MAP = {
  // order / recharge / crypto statuses
  completed:   { bg: 'rgba(54,255,192,0.12)',  border: 'rgba(54,255,192,0.35)',  color: '#36FFC0' },
  approved:    { bg: 'rgba(54,255,192,0.12)',  border: 'rgba(54,255,192,0.35)',  color: '#36FFC0' },
  confirmed:   { bg: 'rgba(54,255,192,0.12)',  border: 'rgba(54,255,192,0.35)',  color: '#36FFC0' },
  active:      { bg: 'rgba(54,255,192,0.12)',  border: 'rgba(54,255,192,0.35)',  color: '#36FFC0' },
  live:        { bg: 'rgba(54,255,192,0.12)',  border: 'rgba(54,255,192,0.35)',  color: '#36FFC0' },
  pending:     { bg: 'rgba(255,200,77,0.12)',  border: 'rgba(255,200,77,0.35)',  color: '#FFC84D' },
  confirming:  { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  color: '#3B82F6' },
  low:         { bg: 'rgba(255,200,77,0.12)',  border: 'rgba(255,200,77,0.35)',  color: '#FFC84D' },
  scheduled:   { bg: 'rgba(255,200,77,0.12)',  border: 'rgba(255,200,77,0.35)',  color: '#FFC84D' },
  failed:      { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  rejected:    { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  expired:     { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  critical:    { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  ended:       { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  inactive:    { bg: 'rgba(255,107,133,0.12)', border: 'rgba(255,107,133,0.35)', color: '#FF6B85' },
  disabled:    { bg: 'rgba(155,79,237,0.12)',  border: 'rgba(155,79,237,0.35)',  color: '#B57BFF' },
  redeemed:    { bg: 'rgba(155,79,237,0.12)',  border: 'rgba(155,79,237,0.35)',  color: '#B57BFF' },
  in_progress: { bg: 'rgba(0,207,255,0.12)',   border: 'rgba(0,207,255,0.35)',   color: '#00CFFF' },
}

/* ═══════════════════════════════════════════════════════════
   LAYOUT PRIMITIVES
   ═══════════════════════════════════════════════════════════ */

/** Root page wrapper — sets bg, scroll, padding */
export function PageShell({ children, style = {} }) {
  return (
    <div className="admin-page-padding" style={{
      flex: 1, overflowY: 'auto',
      background: T.bgPage,
      padding: '24px 28px',
      fontFamily: T.body,
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Title + date line + right-side action buttons */
export function PageHeader({ title, subtitle, actions, onRefresh }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
      <div>
        <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 26, color: T.textPrimary }}>{title}</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{subtitle || today}</div>
      </div>
      <div className="admin-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {actions}
        {onRefresh && (
          <button onClick={onRefresh} title="Refresh" style={QA_STYLE}>
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/** The pill button used in page headers for primary actions */
export function QuickActionButton({ children, onClick, primary = false, danger = false, style: extraStyle = {} }) {
  const base = {
    fontSize: 12, fontWeight: 600, color: T.textPrimary,
    background: primary
      ? 'linear-gradient(135deg,#6D28D9,#9B4FED)'
      : danger
        ? 'rgba(255,107,133,0.12)'
        : `rgba(155,79,237,0.12)`,
    border: primary ? 'none'
      : danger ? '1px solid rgba(255,107,133,0.35)'
      : `1px solid ${T.border}`,
    boxShadow: primary ? '0 6px 16px -6px rgba(124,58,237,0.6)' : 'none',
    padding: '8px 13px', borderRadius: 8,
    display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', transition: 'opacity 0.15s',
    ...extraStyle,
  }
  return <button onClick={onClick} style={base}>{children}</button>
}

/** Rounded card container */
export function Panel({ children, style = {} }) {
  return (
    <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, ...style }}>
      {children}
    </div>
  )
}

/** Panel title row — title + optional subtitle + optional right link */
export function PanelHeader({ title, subtitle, action, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {(action || onAction) && (
        <span onClick={onAction} style={{ fontSize: 11, color: T.purpleText, cursor: 'pointer' }}>
          {actionLabel || action}
        </span>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   STAT WIDGETS
   ═══════════════════════════════════════════════════════════ */

/** Small icon + label + value card */
export function StatCard({ icon, label, value, accent = T.warning, style = {} }) {
  return (
    <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 18, color: T.textPrimary, marginTop: 1 }}>{value ?? '—'}</div>
      </div>
    </div>
  )
}

/** Large featured metric card (sparkline-style) */
export function HeroStat({ label, value, unit = 'DT', foot = [], children }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#2A1050 0%,#190B2E 60%,#0E0818 100%)', border: `1px solid rgba(155,79,237,0.35)`, borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, background: 'radial-gradient(circle,rgba(155,79,237,0.18),transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 38, color: T.textPrimary, lineHeight: 1 }}>
          {value ?? '—'}<span style={{ fontSize: 18, color: '#C39CF5', marginLeft: 4 }}>{unit}</span>
        </div>
      </div>
      {children && <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>{children}</div>}
      {foot.length > 0 && (
        <div style={{ display: 'flex', gap: 22, marginTop: 14, position: 'relative', zIndex: 1 }}>
          {foot.map(({ label: fl, value: fv }) => (
            <div key={fl} style={{ fontSize: 11, color: '#8A7AAE' }}>
              {fl} <b style={{ color: T.textPrimary, fontFamily: T.mono, fontWeight: 600 }}>{fv ?? '—'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   TABLE
   ═══════════════════════════════════════════════════════════ */

export const TH_STYLE = {
  color: T.textMuted, fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  padding: '10px 14px', textAlign: 'left',
  borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
  background: 'rgba(139,79,219,0.04)',
}
export const TD_STYLE = {
  color: '#B3A4D4', fontSize: '0.875rem',
  padding: '10px 14px',
  borderBottom: `1px solid rgba(139,79,219,0.08)`,
  verticalAlign: 'middle',
}

/** Table wrapper with admin styling */
export function DataTable({ headers, children, empty = 'No data.', loading = false, colSpan }) {
  const cols = colSpan || headers.length
  return (
    <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={TH_STYLE}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {loading
            ? <tr><td colSpan={cols} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>Loading…</td></tr>
            : children || <tr><td colSpan={cols} style={{ textAlign: 'center', color: T.textMuted, padding: '3rem', fontSize: '0.875rem' }}>{empty}</td></tr>
          }
        </tbody>
      </table>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   STATUS PILL
   ═══════════════════════════════════════════════════════════ */

export function StatusPill({ status, label }) {
  const key  = (status || '').toLowerCase().replace(' ', '_')
  const cfg  = PILL_MAP[key] || { bg: 'rgba(155,79,237,0.12)', border: `rgba(155,79,237,0.35)`, color: T.purpleText }
  const text = label || (status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : '—')
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {text}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════
   CELL HELPERS
   ═══════════════════════════════════════════════════════════ */

const AVATAR_GRADS = [
  'linear-gradient(135deg,#6D28D9,#9B4FED)',
  'linear-gradient(135deg,#0F9D6B,#36FFC0)',
  'linear-gradient(135deg,#B8860B,#FFC84D)',
  'linear-gradient(135deg,#0891B2,#00CFFF)',
  'linear-gradient(135deg,#B84FED,#FF6BF5)',
  'linear-gradient(135deg,#DC2626,#FF6B85)',
]

export function ClientCell({ name, sub, index = 0 }) {
  const grad = AVATAR_GRADS[index % AVATAR_GRADS.length]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {(name || '?').charAt(0).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: T.textPrimary, fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || '—'}</div>
        {sub && <div style={{ color: T.textMuted, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  )
}

export function ProductCell({ icon = '🎮', name, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(91,77,237,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: T.textPrimary, fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || '—'}</div>
        {sub && <div style={{ color: T.textMuted, fontSize: '0.7rem' }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   FILTER TABS (the pill toggle row used for status filters)
   ═══════════════════════════════════════════════════════════ */

export function FilterTabs({ tabs, value, onChange, style = {} }) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem', background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.625rem', padding: '4px', width: 'fit-content', ...style }}>
      {tabs.map(t => {
        const active = value === (t.value ?? t)
        const label  = t.label ?? t
        const val    = t.value ?? t
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.15s',
            background: active ? 'linear-gradient(135deg,#6D28D9,#9B4FED)' : 'transparent',
            color: active ? '#fff' : T.purpleText,
          }}>{label}</button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   PAGINATION
   ═══════════════════════════════════════════════════════════ */

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const btn = (disabled, onClick, child) => (
    <button onClick={onClick} disabled={disabled} style={{ background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '0.375rem', padding: '4px 8px', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? T.textMuted : T.purpleText, display: 'flex', alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
      {child}
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: `1px solid ${T.border}` }}>
      {btn(page === 1,         () => onChange(page - 1), <ChevronLeft size={14}  />)}
      <span style={{ color: T.purpleText, fontSize: '0.8125rem', fontFamily: T.mono }}>
        {page} / {totalPages}
      </span>
      {btn(page === totalPages, () => onChange(page + 1), <ChevronRight size={14} />)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MISC
   ═══════════════════════════════════════════════════════════ */

/** Horizontal "or continue with" divider inside panels */
export function Divider({ label = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {label && <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  )
}

/** Icon action button (edit, delete, view…) */
export function IconBtn({ children, onClick, title, color = T.purpleText, bg = 'rgba(155,79,237,0.10)', border = T.border }) {
  return (
    <button onClick={onClick} title={title} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '0.375rem', padding: '5px 7px', cursor: 'pointer', color, display: 'flex', alignItems: 'center', transition: 'opacity 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  )
}

/** Money value — always JetBrains Mono, green */
export function Money({ amount, color = T.success }) {
  const val = parseFloat(amount ?? 0).toFixed(2)
  return <span style={{ fontFamily: T.mono, fontWeight: 700, color }}>{val} DT</span>
}

/* ── internal style ── */
const QA_STYLE = {
  fontSize: 12, fontWeight: 600, color: T.textPrimary,
  background: `rgba(155,79,237,0.12)`, border: `1px solid ${T.border}`,
  padding: '8px 10px', borderRadius: 8,
  display: 'flex', alignItems: 'center', gap: 6,
  cursor: 'pointer',
}
