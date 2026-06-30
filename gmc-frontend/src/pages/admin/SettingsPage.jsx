import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSiteSettings, updateSiteSetting, createSiteSetting, uploadHeroImage } from '../../api/admin'
import { useToast } from '../../hooks/useToast'
import {
  Settings, Phone, MapPin, Percent, FileText,
  ChevronDown, ChevronUp, Save, Plus, Trash2, ToggleLeft, ToggleRight,
  Image, Upload, X, Building2, Coins, Smartphone, Bitcoin,
} from 'lucide-react'
import { PageShell, T } from '../../components/admin/AdminUI'

/* ── Helpers ──────────────────────────────────────────────────────────── */
function Section({ title, icon: Icon, color = '#7C3AED', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid #1e1e2e', borderRadius: '0.875rem', overflow: 'hidden', marginBottom: '1rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          width: '100%', padding: '1rem 1.25rem',
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid #1e1e2e' : 'none',
        }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', border: '1px solid ' + color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ flex: 1, textAlign: 'left', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9375rem' }}>{title}</span>
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </button>
      {open && <div style={{ padding: '1.25rem' }}>{children}</div>}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.7 }}>{hint}</p>}
    </div>
  )
}

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: value ? '#3DDC84' : 'var(--text-muted)', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}
    >
      {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{value ? 'Enabled' : 'Disabled'}</span>
    </button>
  )
}

/* ── Hero slide editor ───────────────────────────────────────────────── */
const EMPTY_SLIDE = { title: '', subtitle: '', image: '', cta_text: '', cta_link: '' }

function SlideImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const toast = useToast ? useToast() : { error: alert }

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { data } = await uploadHeroImage(file)
      onChange(data.url)
    } catch {
      toast.error('Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {value ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', height: 110, background: '#0d0d14', border: '1px solid #1e1e2e' }}>
          <img src={value} alt="slide" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            <button onClick={() => inputRef.current?.click()} style={{ background: 'rgba(124,58,237,0.85)', border: 'none', borderRadius: 7, padding: '5px 12px', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={12} /> Change
            </button>
            <button onClick={() => onChange('')} style={{ background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: 7, padding: '5px 10px', color: 'var(--text-primary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%', height: 90, borderRadius: 10, cursor: 'pointer',
            border: '2px dashed rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: uploading ? '#A78BFA' : 'var(--text-muted)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)' }}
        >
          <Upload size={18} color="#A78BFA" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{uploading ? 'Uploading…' : 'Click to upload image'}</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>JPG, PNG, WebP — any size</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  )
}

function HeroSlidesEditor({ slides, onChange }) {
  const add = () => onChange([...slides, { ...EMPTY_SLIDE }])
  const remove = (i) => onChange(slides.filter((_, idx) => idx !== i))
  const update = (i, field, val) => onChange(slides.map((s, idx) => idx === i ? { ...s, [field]: val } : s))

  return (
    <div>
      {slides.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1.5rem' }}>No slides yet. Add one below.</p>
      )}
      {slides.map((slide, i) => (
        <div key={i} style={{ border: '1px solid #1e1e2e', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem', background: 'rgba(124,58,237,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <span style={{ color: 'var(--lavender)', fontWeight: 700, fontSize: '0.8125rem' }}>Slide {i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}>
              <Trash2 size={12} /> Remove
            </button>
          </div>

          {/* Image upload — full width */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>Background Image</label>
            <SlideImageUpload value={slide.image} onChange={val => update(i, 'image', val)} />
          </div>

          <div className="admin-settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <Field label="Title">
              <input value={slide.title} onChange={e => update(i, 'title', e.target.value)} placeholder="Hero headline" />
            </Field>
            <Field label="Subtitle">
              <input value={slide.subtitle} onChange={e => update(i, 'subtitle', e.target.value)} placeholder="Short tagline" />
            </Field>
            <Field label="CTA Button Text">
              <input value={slide.cta_text} onChange={e => update(i, 'cta_text', e.target.value)} placeholder="Shop Now" />
            </Field>
            <Field label="CTA Link" hint="e.g. /?cat=games">
              <input value={slide.cta_link} onChange={e => update(i, 'cta_link', e.target.value)} placeholder="/products" />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.625rem', border: '1px dashed rgba(124,58,237,0.4)', borderRadius: '0.5rem', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, width: '100%', justifyContent: 'center' }}
      >
        <Plus size={14} /> Add Slide
      </button>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const toast = useToast()
  const qc    = useQueryClient()
  const [saving, setSaving] = useState(false)

  /* Load all SiteSettings rows */
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => getSiteSettings().then(r => r.data),
  })

  /* Local editable state, keyed by SiteSettings key */
  const [vals, setVals] = useState({})
  const [slides, setSlides] = useState([])

  useEffect(() => {
    if (!rows.length) return
    const map = {}
    rows.forEach(r => { map[r.key] = r })
    setVals(map)
    try {
      const raw = rows.find(r => r.key === 'HERO_SLIDES')?.value
      setSlides(raw ? JSON.parse(raw) : [])
    } catch {
      setSlides([])
    }
  }, [rows])

  const get = (key, fallback = '') => vals[key]?.value ?? fallback
  const set = (key, value) => setVals(v => ({ ...v, [key]: { ...(v[key] || {}), key, value } }))

  /* Upsert a single SiteSettings key */
  const upsert = async (key, value, label = '') => {
    const existing = rows.find(r => r.key === key)
    if (existing) {
      await updateSiteSetting(existing.id, { value })
    } else {
      await createSiteSetting({ key, value, label })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        upsert('TICKET_TAX_RATE',           get('TICKET_TAX_RATE', '0.11'),           'Ticket tax rate (decimal, e.g. 0.11)'),
        upsert('D17_PHONE_NUMBER',           get('D17_PHONE_NUMBER'),                  'D17 phone number 1'),
        upsert('D17_PHONE_NUMBER_2',         get('D17_PHONE_NUMBER_2'),                'D17 phone number 2'),
        upsert('D17_PHONE_NUMBER_3',         get('D17_PHONE_NUMBER_3'),                'D17 phone number 3'),
        upsert('D17_PHONE_ENABLED',          get('D17_PHONE_ENABLED', 'true'),         'D17 phone enabled'),
        upsert('D17_ADDRESS',                get('D17_ADDRESS'),                       'D17 address / RIB'),
        upsert('D17_ADDRESS_LABEL',          get('D17_ADDRESS_LABEL', 'D17 Account Address'), 'D17 address label'),
        upsert('D17_ADDRESS_ENABLED',        get('D17_ADDRESS_ENABLED', 'true'),       'D17 address enabled'),
        upsert('BANK_TRANSFER_ENABLED',      get('BANK_TRANSFER_ENABLED', 'true'),     'Bank Transfer enabled'),
        upsert('BANK_ACCOUNT_NUMBER',        get('BANK_ACCOUNT_NUMBER'),               'Bank account number / RIB'),
        upsert('BANK_ACCOUNT_NAME',          get('BANK_ACCOUNT_NAME'),                 'Bank account holder name'),
        upsert('BANK_TRANSFER_INSTRUCTIONS', get('BANK_TRANSFER_INSTRUCTIONS'),        'Bank Transfer instructions'),
        upsert('EDINAR_ENABLED',             get('EDINAR_ENABLED', 'true'),            'E-Dinar enabled'),
        upsert('EDINAR_ACCOUNT_NUMBER',      get('EDINAR_ACCOUNT_NUMBER'),             'E-Dinar account number'),
        upsert('EDINAR_INSTRUCTIONS',        get('EDINAR_INSTRUCTIONS'),               'E-Dinar instructions'),
        upsert('FLOUCI_ENABLED',             get('FLOUCI_ENABLED', 'true'),            'Flouci enabled'),
        upsert('FLOUCI_PHONE_NUMBER',        get('FLOUCI_PHONE_NUMBER'),               'Flouci phone number'),
        upsert('FLOUCI_INSTRUCTIONS',        get('FLOUCI_INSTRUCTIONS'),               'Flouci instructions'),
        upsert('OOREDOO_INSTRUCTIONS',       get('OOREDOO_INSTRUCTIONS'),              'Ooredoo ticket instructions'),
        upsert('ORANGE_INSTRUCTIONS',        get('ORANGE_INSTRUCTIONS'),               'Orange ticket instructions'),
        upsert('HERO_SLIDES',                JSON.stringify(slides),                   'Hero carousel slides (JSON)'),
        upsert('BINANCE_ADDRESS',            get('BINANCE_ADDRESS'),                   'Binance USDT (BEP-20) wallet address'),
        upsert('BNB_ADDRESS',                get('BNB_ADDRESS'),                       'BNB (BEP-20) wallet address'),
        upsert('CRYPTO_ENABLED',             get('CRYPTO_ENABLED', 'true'),            'Crypto payments enabled'),
      ])
      await qc.invalidateQueries({ queryKey: ['site-settings'] })
      toast.success('Settings saved.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return (
    <PageShell style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: T.textMuted }}>Loading…</span>
    </PageShell>
  )

  const taxPct = Math.round(parseFloat(get('TICKET_TAX_RATE', '0.11')) * 100)

  return (
    <PageShell style={{ maxWidth: 820 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(155,79,237,0.15)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={17} color={T.purpleText} />
          </div>
          <div>
            <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 22, color: T.textPrimary }}>Site Settings</div>
            <div style={{ color: T.textMuted, fontSize: '0.75rem', marginTop: 1 }}>Payment methods, fee rates, hero slides</div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5625rem 1.25rem', background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {/* ── Ticket fee ── */}
      <Section title="Ticket Fee Rate" icon={Percent} color="#f59e0b">
        <Field label={`Tax rate — currently ${taxPct}%`} hint="Decimal value: 0.11 = 11%. Applies to Ooredoo and Orange tickets.">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="number" min="0" max="1" step="0.01"
              value={get('TICKET_TAX_RATE', '0.11')}
              onChange={e => set('TICKET_TAX_RATE', e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 14px' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem' }}>
                {taxPct}% fee → user gets {100 - taxPct}%
              </span>
            </div>
          </div>
        </Field>
      </Section>

      {/* ── D17 Phone ── */}
      <Section title="D17 — Phone Numbers" icon={Phone} color="#7C3AED">
        <Field label="Enabled">
          <ToggleSwitch
            value={get('D17_PHONE_ENABLED', 'true') === 'true'}
            onChange={v => set('D17_PHONE_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="D17 Number 1" hint="Primary number — always shown to users">
          <input
            type="text"
            value={get('D17_PHONE_NUMBER')}
            onChange={e => set('D17_PHONE_NUMBER', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="admin-settings-input" style={{ fontFamily: 'JetBrains Mono, monospace', maxWidth: 300 }}
          />
        </Field>
        <Field label="D17 Number 2" hint="Optional second number">
          <input
            type="text"
            value={get('D17_PHONE_NUMBER_2')}
            onChange={e => set('D17_PHONE_NUMBER_2', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="admin-settings-input" style={{ fontFamily: 'JetBrains Mono, monospace', maxWidth: 300 }}
          />
        </Field>
        <Field label="D17 Number 3" hint="Optional third number">
          <input
            type="text"
            value={get('D17_PHONE_NUMBER_3')}
            onChange={e => set('D17_PHONE_NUMBER_3', e.target.value)}
            placeholder="+216 XX XXX XXX"
            className="admin-settings-input" style={{ fontFamily: 'JetBrains Mono, monospace', maxWidth: 300 }}
          />
        </Field>
      </Section>

      {/* ── D17 Address ── */}
      <Section title="D17 — Address / RIB" icon={MapPin} color="#3b82f6">
        <Field label="Enabled">
          <ToggleSwitch
            value={get('D17_ADDRESS_ENABLED', 'true') === 'true'}
            onChange={v => set('D17_ADDRESS_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="Address Label" hint="Label shown above the address (e.g. 'D17 Account Address' or 'RIB')">
          <input
            value={get('D17_ADDRESS_LABEL', 'D17 Account Address')}
            onChange={e => set('D17_ADDRESS_LABEL', e.target.value)}
            placeholder="D17 Account Address"
            className="admin-settings-input" style={{ maxWidth: 340 }}
          />
        </Field>
        <Field label="Address / RIB" hint="Shown to users when they select D17 Address method">
          <input
            value={get('D17_ADDRESS')}
            onChange={e => set('D17_ADDRESS', e.target.value)}
            placeholder="D17 address or RIB number"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
        </Field>
      </Section>

      {/* ── Bank Transfer ── */}
      <Section title="Bank Transfer (Bancaire)" icon={Building2} color="#3b82f6">
        <Field label="Enabled">
          <ToggleSwitch
            value={get('BANK_TRANSFER_ENABLED', 'true') === 'true'}
            onChange={v => set('BANK_TRANSFER_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="Account Holder Name" hint="Bank account holder name shown to users">
          <input
            value={get('BANK_ACCOUNT_NAME')}
            onChange={e => set('BANK_ACCOUNT_NAME', e.target.value)}
            placeholder="e.g. GMC Store SARL"
            style={{ maxWidth: 360 }}
          />
        </Field>
        <Field label="Account Number / RIB" hint="Bank account number or RIB shown to users">
          <input
            value={get('BANK_ACCOUNT_NUMBER')}
            onChange={e => set('BANK_ACCOUNT_NUMBER', e.target.value)}
            placeholder="e.g. 00 000 0000000000000 00"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
        </Field>
        <Field label="Instructions" hint="Shown to users inside the bank transfer form">
          <textarea
            rows={3}
            value={get('BANK_TRANSFER_INSTRUCTIONS')}
            onChange={e => set('BANK_TRANSFER_INSTRUCTIONS', e.target.value)}
            placeholder="e.g. Transfer the amount to the account above, then submit the bank reference number and a screenshot."
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          />
        </Field>
      </Section>

      {/* ── E-Dinar ── */}
      <Section title="E-Dinar" icon={Coins} color="#10b981">
        <Field label="Enabled">
          <ToggleSwitch
            value={get('EDINAR_ENABLED', 'true') === 'true'}
            onChange={v => set('EDINAR_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="E-Dinar Account Number" hint="Shown to users when they select E-Dinar">
          <input
            value={get('EDINAR_ACCOUNT_NUMBER')}
            onChange={e => set('EDINAR_ACCOUNT_NUMBER', e.target.value)}
            placeholder="E-Dinar account number"
            style={{ fontFamily: 'JetBrains Mono, monospace', maxWidth: 340 }}
          />
        </Field>
        <Field label="Instructions" hint="Shown to users inside the E-Dinar form">
          <textarea
            rows={3}
            value={get('EDINAR_INSTRUCTIONS')}
            onChange={e => set('EDINAR_INSTRUCTIONS', e.target.value)}
            placeholder="e.g. Send via E-Dinar app to the account above, then enter the transaction ID."
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          />
        </Field>
      </Section>

      {/* ── Flouci ── */}
      <Section title="Flouci" icon={Smartphone} color="#f59e0b">
        <Field label="Enabled">
          <ToggleSwitch
            value={get('FLOUCI_ENABLED', 'true') === 'true'}
            onChange={v => set('FLOUCI_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="Flouci Phone Number" hint="Shown to users when they select Flouci">
          <input
            value={get('FLOUCI_PHONE_NUMBER')}
            onChange={e => set('FLOUCI_PHONE_NUMBER', e.target.value)}
            placeholder="+216 XX XXX XXX"
            style={{ fontFamily: 'JetBrains Mono, monospace', maxWidth: 260 }}
          />
        </Field>
        <Field label="Instructions" hint="Shown to users inside the Flouci form">
          <textarea
            rows={3}
            value={get('FLOUCI_INSTRUCTIONS')}
            onChange={e => set('FLOUCI_INSTRUCTIONS', e.target.value)}
            placeholder="e.g. Send via Flouci to the number above, then enter the transaction ID."
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          />
        </Field>
      </Section>

      {/* ── Ticket instructions ── */}
      <Section title="Ticket Instructions" icon={FileText} color="#e53e3e" defaultOpen={false}>
        <Field label="Ooredoo Instructions" hint="Shown inside the Ooredoo ticket form">
          <textarea
            rows={3}
            value={get('OOREDOO_INSTRUCTIONS')}
            onChange={e => set('OOREDOO_INSTRUCTIONS', e.target.value)}
            placeholder="e.g. Buy an Ooredoo recharge ticket from any store, scratch to reveal the code, then enter it below."
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          />
        </Field>
        <Field label="Orange Instructions" hint="Shown inside the Orange ticket form">
          <textarea
            rows={3}
            value={get('ORANGE_INSTRUCTIONS')}
            onChange={e => set('ORANGE_INSTRUCTIONS', e.target.value)}
            placeholder="e.g. Buy an Orange recharge ticket, scratch to reveal the code, then enter it below."
            style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
          />
        </Field>
      </Section>

      {/* ── Crypto Wallets ── */}
      <Section title="Crypto Wallets" icon={Bitcoin} color="#f7931a" defaultOpen={false}>
        <Field label="Enabled">
          <ToggleSwitch
            value={get('CRYPTO_ENABLED', 'true') === 'true'}
            onChange={v => set('CRYPTO_ENABLED', v ? 'true' : 'false')}
          />
        </Field>
        <Field label="Binance USDT — Wallet Address (BEP-20)" hint="Users will send USDT on BNB Smart Chain (BSC) to this address">
          <input
            value={get('BINANCE_ADDRESS')}
            onChange={e => set('BINANCE_ADDRESS', e.target.value)}
            placeholder="0x..."
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
        </Field>
        <Field label="BNB — Wallet Address (BEP-20)" hint="Users will send BNB on BNB Smart Chain (BSC) to this address">
          <input
            value={get('BNB_ADDRESS')}
            onChange={e => set('BNB_ADDRESS', e.target.value)}
            placeholder="0x..."
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
        </Field>
      </Section>

      {/* ── Hero slides ── */}
      <Section title="Hero Carousel Slides" icon={Image} color="#3DDC84" defaultOpen={false}>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
          These slides appear in the hero banner on the shop page. Each slide has a title, subtitle, background image, and an optional CTA button.
        </p>
        <HeroSlidesEditor slides={slides} onChange={setSlides} />
      </Section>

      {/* Save button repeated at bottom */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.625rem 1.5rem', background: '#7C3AED', border: 'none', borderRadius: '0.5rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </div>
    </PageShell>
  )
}
