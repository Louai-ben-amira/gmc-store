import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getWallet, getTransactions, submitRecharge, getPaymentMethods, previewRecharge, initiateCrypto, getCryptoQR, submitTxHash, redeemGiftCard } from '../api/wallet'
import Modal from '../components/Modal'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import { useToast } from '../hooks/useToast'
import { formatDate, formatCurrency } from '../utils/formatters'
import {
  TbWallet, TbStar, TbPlus, TbUpload, TbArrowUp, TbArrowDown,
  TbCopy, TbCheck, TbCurrencyBitcoin, TbCircleCheck,
  TbChevronRight, TbShieldCheck, TbBolt, TbTicket, TbDeviceMobile,
  TbBuildingBank, TbAlertCircle, TbCreditCard, TbCoins,
} from 'react-icons/tb'

/* ── Helpers ─────────────────────────────────────────────────────────── */
const CRYPTO_OPTIONS = [
  { value: 'BINANCE', label: 'Binance (USDT)', color: '#f0b90b' },
  { value: 'BNB',     label: 'BNB',            color: '#f3ba2f' },
]

function MonoLabel({ children }) {
  return (
    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 8px' }}>
      {children}
    </p>
  )
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#3DDC84' : 'var(--text-muted)', padding: '2px 4px', display: 'inline-flex', alignItems: 'center', transition: 'color 0.15s' }}>
      {copied ? <TbCheck size={13} /> : <TbCopy size={13} />}
    </button>
  )
}

function useCountdownTimer(expiresAt) {
  const calc = useCallback(() => {
    if (!expiresAt) return null
    const diff = new Date(expiresAt) - Date.now()
    if (diff <= 0) return null
    return { m: Math.floor(diff / 60000), s: Math.floor((diff % 60000) / 1000), critical: diff < 5 * 60 * 1000 }
  }, [expiresAt])
  const [time, setTime] = useState(calc)
  useEffect(() => { const id = setInterval(() => setTime(calc()), 1000); return () => clearInterval(id) }, [calc])
  return time
}

/* ── Crypto payment section (unchanged logic) ────────────────────────── */
function CryptoPaymentSection({ onSuccess, onClose }) {
  const [currency, setCurrency] = useState('BINANCE')
  const [amount,   setAmount]   = useState('')
  const [step,     setStep]     = useState(1)
  const [crypto,   setCrypto]   = useState(null)
  const [qrData,   setQrData]   = useState(null)
  const [txHash,   setTxHash]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const toast = useToast()
  const timer = useCountdownTimer(crypto?.expires_at)

  const handleInitiate = async () => {
    if (!amount || parseFloat(amount) < 5) { toast.error('Minimum amount is 5 DT.'); return }
    setLoading(true)
    try {
      const { data } = await initiateCrypto({ currency, amount_dt: amount })
      setCrypto(data)
      const qr = await getCryptoQR(data.id)
      setQrData(qr.data.qr)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create payment. Check admin wallet settings.')
    } finally { setLoading(false) }
  }

  const handleSubmitTx = async () => {
    if (!txHash.trim()) { toast.error(currency === 'BINANCE' ? 'Please enter your Binance Order ID.' : 'Please enter the transaction hash.'); return }
    setLoading(true)
    try {
      await submitTxHash(crypto.id, { tx_hash: txHash.trim() })
      toast.success('Transaction submitted! Admin will verify and credit your wallet.')
      setStep(3); onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit transaction.')
    } finally { setLoading(false) }
  }

  if (step === 3) return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <TbCircleCheck size={30} color="#3DDC84" />
      </div>
      <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>Transaction Submitted!</p>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Admin will verify your transaction hash and credit your balance shortly.
      </p>
      <button className="btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>Done</button>
    </div>
  )

  if (step === 2 && crypto) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{
        textAlign: 'center', padding: '10px',
        background: timer ? (timer.critical ? 'rgba(255,77,109,0.08)' : 'rgba(61,220,132,0.06)') : 'rgba(255,77,109,0.08)',
        border: '1px solid ' + (timer ? (timer.critical ? 'rgba(255,77,109,0.3)' : 'rgba(61,220,132,0.2)') : 'rgba(255,77,109,0.3)'),
        borderRadius: 10,
      }}>
        {timer ? (
          <>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.375rem', color: timer.critical ? '#ff4d6d' : '#3DDC84' }}>
              {String(timer.m).padStart(2, '0')}:{String(timer.s).padStart(2, '0')}
            </span>
            <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment window remaining</p>
          </>
        ) : (
          <p style={{ margin: 0, color: '#ff4d6d', fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>Payment Expired</p>
        )}
      </div>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SEND EXACTLY</p>
        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
          {parseFloat(crypto.amount_crypto).toFixed(8)} <span style={{ color: '#f59e0b' }}>{crypto.currency.replace('_', ' ')}</span>
        </p>
        <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>≈ {crypto.amount_dt} DT</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <img
          src={currency === 'BNB' ? '/QRbnb.jpeg' : '/QRbinance.jpeg'}
          alt="Wallet QR"
          style={{ width: 180, height: 180, borderRadius: 12, border: '2px solid rgba(255,255,255,0.08)' }}
        />
      </div>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ margin: '0 0 5px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wallet Address</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1, wordBreak: 'break-all' }}>{crypto.wallet_address}</code>
          <CopyBtn text={crypto.wallet_address} />
        </div>
      </div>
      <div>
        <MonoLabel>{currency === 'BINANCE' ? 'Binance Order ID' : 'Transaction Hash (TX Hash)'}</MonoLabel>
        <input
          value={txHash}
          onChange={e => setTxHash(e.target.value)}
          placeholder={currency === 'BINANCE' ? 'Paste your Binance Order ID (e.g. 123456789)' : 'Paste your BSC TX hash (0x...)'}
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem' }}
        />
        <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {currency === 'BINANCE'
            ? 'Found in Binance app → Wallet → Transaction History → Order ID.'
            : 'Found in your wallet app after sending - starts with 0x.'}
        </p>
      </div>
      <button className="btn-primary" onClick={handleSubmitTx} disabled={loading || !txHash.trim()} style={{ width: '100%', justifyContent: 'center' }}>
        {loading ? 'Submitting…' : '⚡ I Sent the Payment'}
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <MonoLabel>Amount (DT)</MonoLabel>
        <input type="number" min="5" step="0.01" placeholder="Minimum 5 DT" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div>
        <MonoLabel>Cryptocurrency</MonoLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {CRYPTO_OPTIONS.map(opt => {
            const active = currency === opt.value
            return (
              <button key={opt.value} type="button" onClick={() => setCurrency(opt.value)} style={{
                padding: '8px 10px', borderRadius: 9,
                border: '1px solid ' + (active ? opt.color + '50' : 'rgba(255,255,255,0.07)'),
                background: active ? opt.color + '14' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: '0.8125rem', fontWeight: active ? 700 : 400,
                color: active ? opt.color : 'rgba(255,255,255,0.45)', transition: 'all 0.13s', textAlign: 'left',
              }}>{opt.label}</button>
            )
          })}
        </div>
      </div>
      <button className="btn-primary" onClick={handleInitiate} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
        <TbCurrencyBitcoin size={15} /> {loading ? 'Creating payment…' : 'Get Payment Address'}
      </button>
    </div>
  )
}

/* ── Credit preview box ──────────────────────────────────────────────── */
function CreditPreview({ method, ticketValue, amountSent }) {
  const [preview, setPreview] = useState(null)
  const debounceRef = useRef(null)

  const isTicketMethod = method === 'ooredoo_ticket' || method === 'orange_ticket'
  const inputVal = isTicketMethod ? parseFloat(ticketValue) : parseFloat(amountSent)

  useEffect(() => {
    if (!inputVal || inputVal <= 0) { setPreview(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const payload = { method }
        if (isTicketMethod) payload.ticket_value = inputVal
        else payload.amount_sent = inputVal
        const { data } = await previewRecharge(payload)
        setPreview(data)
      } catch { setPreview(null) }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [method, inputVal, isTicketMethod])

  if (!preview) return null

  const hasFee       = preview.tax_rate > 0 || preview.tax_amount > 0
  const pctFee       = method === 'd17_number'    // percentage fee deducted
  const flatFee      = method === 'bank_transfer' // flat fee deducted

  return (
    <div style={{ background: 'rgba(61,220,132,0.05)', border: '1px solid rgba(61,220,132,0.18)', borderRadius: 12, padding: '1rem' }}>
      <MonoLabel>Credit Preview</MonoLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {isTicketMethod ? 'Ticket value' : 'Amount you want credited'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{inputVal.toFixed(2)} DT</span>
        </div>

        {hasFee && pctFee && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#ff4d6d' }}>Service fee ({(preview.tax_rate * 100).toFixed(0)}%)</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#ff4d6d' }}>−{preview.tax_amount.toFixed(2)} DT</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(61,220,132,0.2)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>You'll receive</span>
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: '#3DDC84' }}>{preview.wallet_credit.toFixed(2)} DT</span>
            </div>
          </>
        )}

        {hasFee && flatFee && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#ff4d6d' }}>Bank fee (flat)</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#ff4d6d' }}>−{preview.tax_amount.toFixed(2)} DT</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(61,220,132,0.2)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>You'll receive</span>
              <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: '#3DDC84' }}>{preview.wallet_credit.toFixed(2)} DT</span>
            </div>
          </>
        )}

        {!hasFee && (
          <div style={{ borderTop: '1px solid rgba(61,220,132,0.2)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>You'll receive</span>
            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: '#3DDC84' }}>{preview.wallet_credit.toFixed(2)} DT</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Method card ─────────────────────────────────────────────────────── */
function MethodCard({ value, label, subtitle, icon: Icon, color, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
      border: '1px solid ' + (active ? color + '60' : 'rgba(255,255,255,0.07)'),
      background: active ? color + '14' : 'rgba(255,255,255,0.02)',
      transition: 'all 0.13s', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: active ? `0 0 0 1px ${color}20, 0 4px 12px ${color}18` : 'none',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: active ? color + '20' : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (active ? color + '40' : 'rgba(255,255,255,0.06)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color={active ? color : 'var(--text-muted)'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontSize: '0.8125rem', fontWeight: active ? 700 : 500, color: active ? 'white' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: active ? color : 'rgba(255,255,255,0.28)', marginTop: 1 }}>{subtitle}</p>
      </div>
      {active && <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />}
    </button>
  )
}

/* ── Recharge Modal ──────────────────────────────────────────────────── */
const mkTicket = () => ({ id: Date.now() + Math.random(), code: '', value: '' })

function RechargeModal({ isOpen, onClose, onSuccess }) {
  const [tab,           setTab]           = useState('manual')
  const [method,        setMethod]        = useState('ooredoo_ticket')
  // Multi-ticket state
  const [tickets,       setTickets]       = useState([mkTicket()])
  const [submittedCount,setSubmittedCount]= useState(0)
  // Transfer state
  const [amountSent,    setAmountSent]    = useState('')
  const [referenceCode, setReferenceCode] = useState('')
  const [selectedD17,   setSelectedD17]   = useState('')
  const [proof,         setProof]         = useState(null)
  const [step,          setStep]          = useState(1)
  const [loading,       setLoading]       = useState(false)
  const [errors,        setErrors]        = useState({})
  const toast = useToast()

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => getPaymentMethods().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const TRANSFER_METHODS = ['d17_number', 'd17_address', 'bank_transfer', 'flouci']
  const isTicket   = method === 'ooredoo_ticket' || method === 'orange_ticket'
  const isTransfer = TRANSFER_METHODS.includes(method)
  const methodInfo = methods?.[method] || {}

  const taxRate       = methods?.[method]?.tax_rate ?? 0.11
  const totalFaceVal  = tickets.reduce((s, t) => s + (parseFloat(t.value) || 0), 0)
  const totalCredit   = totalFaceVal * (1 - taxRate)
  const feeTotal      = totalFaceVal * taxRate

  const resetForm = () => {
    setMethod('ooredoo_ticket'); setTickets([mkTicket()])
    setAmountSent(''); setReferenceCode(''); setSelectedD17(''); setProof(null)
    setStep(1); setErrors({}); setSubmittedCount(0)
  }

  const handleClose = () => { onClose(); resetForm() }

  /* ── Ticket row helpers ── */
  const updateTicket = (id, field, val) =>
    setTickets(ts => ts.map(t => t.id === id ? { ...t, [field]: val } : t))
  const addTicket    = () => setTickets(ts => [...ts, mkTicket()])
  const removeTicket = (id) => setTickets(ts => ts.filter(t => t.id !== id))

  /* ── Validation ── */
  const validate = () => {
    const e = {}
    if (isTicket) {
      tickets.forEach((t, i) => {
        if (!t.code.trim()) e[`code_${i}`] = 'Required'
        if (!t.value || parseFloat(t.value) <= 0) e[`value_${i}`] = 'Required'
      })
    }
    if (isTransfer) {
      if (!amountSent || parseFloat(amountSent) <= 0) e.amountSent = 'Enter the amount you sent.'
      if (!referenceCode.trim()) e.referenceCode = 'Transaction reference number is required.'
      if (method === 'd17_number' && (methodInfo.numbers?.length > 1) && !selectedD17) e.selectedD17 = 'Select which D17 number you sent to.'
    }
    if (!proof) e.proof = 'Please upload a photo of the ticket or payment screenshot.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    if (isTicket) {
      try {
        const fd = new FormData()
        fd.append('method', method)
        fd.append('tickets', JSON.stringify(tickets.map(t => ({ code: t.code.trim(), value: t.value }))))
        if (proof) fd.append('proof', proof)
        await submitRecharge(fd)
        setSubmittedCount(tickets.length)
        onSuccess(); setStep(2)
      } catch (err) {
        const data = err.response?.data
        toast.error(data?.tickets?.[0] || data?.detail || 'Submission failed. Please try again.')
      } finally {
        setLoading(false)
      }
      return
    }

    // Transfer - single submit
    try {
      const fd = new FormData()
      fd.append('method', method)
      fd.append('amount_sent', amountSent)
      const ref = referenceCode.trim()
      fd.append('reference_code', method === 'd17_number' && selectedD17 ? `[→ ${selectedD17}] ${ref}` : ref)
      if (proof) fd.append('proof', proof)
      await submitRecharge(fd)
      onSuccess(); setStep(2)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const mapped = {}
        if (data.amount_sent)    mapped.amountSent    = data.amount_sent[0]    || data.amount_sent
        if (data.reference_code) mapped.referenceCode = data.reference_code[0] || data.reference_code
        if (Object.keys(mapped).length) setErrors(mapped)
        else toast.error(data.detail || 'Submission failed.')
      } else toast.error('Submission failed. Please try again.')
    } finally { setLoading(false) }
  }

  const taxPct = Math.round(taxRate * 100) + '% fee'
  const ALL_METHODS = [
    { value: 'ooredoo_ticket', label: 'Ooredoo',    subtitle: taxPct,         icon: TbTicket,       color: '#e53e3e', group: 'ticket'   },
    { value: 'orange_ticket',  label: 'Orange',     subtitle: taxPct,         icon: TbTicket,       color: '#f97316', group: 'ticket'   },
    { value: 'd17_number',     label: 'D17 Phone',  subtitle: '1% fee',       icon: TbDeviceMobile, color: '#7C3AED', group: 'transfer' },
    { value: 'd17_address',    label: 'D17 RIB',    subtitle: 'No fee',       icon: TbBuildingBank, color: '#7C3AED', group: 'transfer' },
    { value: 'bank_transfer',  label: 'Bancaire',   subtitle: 'Frais 2.5 DT', icon: TbCreditCard,   color: '#3b82f6', group: 'transfer' },
    { value: 'flouci',         label: 'Flouci',     subtitle: 'No fee',       icon: TbDeviceMobile, color: '#f59e0b', group: 'transfer' },
  ].filter(m => methods?.[m.value]?.enabled !== false)
  const ticketMethods   = ALL_METHODS.filter(m => m.group === 'ticket')
  const transferMethods = ALL_METHODS.filter(m => m.group === 'transfer')

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Recharge Wallet" size="sm">
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
        {[{ key: 'manual', label: 'Recharge' }, { key: 'crypto', label: '₿ Crypto' }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); resetForm() }} style={{
            flex: 1, padding: '7px', borderRadius: 9, border: 'none',
            background: tab === t.key ? 'rgba(124,58,237,0.18)' : 'transparent',
            color: tab === t.key ? '#A78BFA' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem',
            fontWeight: tab === t.key ? 700 : 400, transition: 'all 0.13s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'crypto' ? (
        <CryptoPaymentSection onSuccess={onSuccess} onClose={handleClose} />
      ) : step === 2 ? (
        /* ── Done ── */
        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <TbCircleCheck size={30} color="#3DDC84" />
          </div>
          <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {submittedCount > 1
              ? `${submittedCount} tickets submitted!`
              : 'Request Submitted!'}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
            We'll review your request and credit your wallet.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '5px 12px', marginBottom: 20 }}>
            <TbAlertCircle size={13} color="#f59e0b" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#f59e0b' }}>⏳ Pending review - usually within a few hours</span>
          </div>
          <button className="btn-primary" onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>Done</button>
        </div>
      ) : (
        /* ── Form ── */
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Method selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MonoLabel>Payment Method</MonoLabel>
            {ticketMethods.length > 0 && (
              <div>
                <p style={{ margin: '0 0 5px', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recharge Ticket</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {ticketMethods.map(m => (
                    <MethodCard key={m.value} {...m} active={method === m.value} onClick={() => { setMethod(m.value); setErrors({}) }} />
                  ))}
                </div>
              </div>
            )}
            {transferMethods.length > 0 && (
              <div>
                <p style={{ margin: '0 0 5px', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Bank / Transfer</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {transferMethods.map(m => (
                    <MethodCard key={m.value} {...m} active={method === m.value} onClick={() => { setMethod(m.value); setErrors({}) }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Multi-ticket form ── */}
          {isTicket && (
            <>
              {methodInfo.instructions && (
                <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'rgba(167,139,250,0.8)', lineHeight: 1.6 }}>{methodInfo.instructions}</p>
                </div>
              )}

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6, alignItems: 'center' }}>
                <MonoLabel style={{ margin: 0 }}>Ticket Code</MonoLabel>
                <MonoLabel style={{ margin: 0 }}>Value (DT)</MonoLabel>
                <span />
              </div>

              {/* Ticket rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tickets.map((t, i) => (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6, alignItems: 'flex-start' }}>
                    <div>
                      <input
                        value={t.code}
                        onChange={e => updateTicket(t.id, 'code', e.target.value)}
                        placeholder={`Code #${i + 1}`}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', borderColor: errors[`code_${i}`] ? '#ff4d6d' : undefined }}
                      />
                      {errors[`code_${i}`] && <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: '#ff4d6d' }}>{errors[`code_${i}`]}</p>}
                    </div>
                    <div>
                      <input
                        type="number" min="1" step="0.01"
                        value={t.value}
                        onChange={e => updateTicket(t.id, 'value', e.target.value)}
                        placeholder="e.g. 10"
                        style={{ borderColor: errors[`value_${i}`] ? '#ff4d6d' : undefined }}
                      />
                      {errors[`value_${i}`] && <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: '#ff4d6d' }}>{errors[`value_${i}`]}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => tickets.length > 1 && removeTicket(t.id)}
                      disabled={tickets.length === 1}
                      style={{
                        width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 7, border: '1px solid rgba(255,77,109,0.25)',
                        background: tickets.length === 1 ? 'transparent' : 'rgba(255,77,109,0.08)',
                        cursor: tickets.length === 1 ? 'default' : 'pointer',
                        color: tickets.length === 1 ? 'rgba(255,255,255,0.15)' : '#ff4d6d',
                        fontSize: '1rem', lineHeight: 1, padding: 0, flexShrink: 0,
                        transition: 'all 0.13s',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>

              {/* Add ticket button */}
              <button
                type="button"
                onClick={addTicket}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px', borderRadius: 9, border: '1px dashed rgba(124,58,237,0.35)',
                  background: 'rgba(124,58,237,0.05)', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
                  color: '#A78BFA', transition: 'all 0.13s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.05)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)' }}
              >
                <TbPlus size={14} /> Add Another Ticket
              </button>

              {/* Live total preview */}
              {totalFaceVal > 0 && (
                <div style={{ background: 'rgba(61,220,132,0.05)', border: '1px solid rgba(61,220,132,0.18)', borderRadius: 12, padding: '1rem' }}>
                  <MonoLabel>Total Preview - {tickets.length} ticket{tickets.length > 1 ? 's' : ''}</MonoLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Total face value</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{totalFaceVal.toFixed(2)} DT</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#ff4d6d' }}>Fee ({Math.round(taxRate * 100)}%)</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', color: '#ff4d6d' }}>−{feeTotal.toFixed(2)} DT</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(61,220,132,0.2)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>You'll receive</span>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: '#3DDC84' }}>{totalCredit.toFixed(2)} DT</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Transfer form */}
          {isTransfer && (
            <>
              {/* D17 multi-number picker */}
              {method === 'd17_number' && methodInfo.numbers?.length > 1 && (
                <div>
                  <MonoLabel>Choose D17 Number to Send To</MonoLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {methodInfo.numbers.map((num, i) => {
                      const active = selectedD17 === num
                      return (
                        <button
                          key={i} type="button"
                          onClick={() => { setSelectedD17(num); setErrors(v => ({ ...v, selectedD17: undefined })) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                            border: '1px solid ' + (active ? '#7C3AED60' : 'rgba(255,255,255,0.07)'),
                            background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
                            transition: 'all 0.13s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (active ? '#7C3AED40' : 'rgba(255,255,255,0.06)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <TbDeviceMobile size={15} color={active ? '#A78BFA' : 'var(--text-muted)'} />
                            </div>
                            <div>
                              <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9375rem', fontWeight: 700, color: active ? 'white' : 'var(--text-secondary)', letterSpacing: '0.04em' }}>{num}</p>
                              <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: active ? '#A78BFA' : 'var(--text-muted)' }}>D17 Number {i + 1}</p>
                            </div>
                          </div>
                          {active && <CopyBtn text={num} />}
                        </button>
                      )
                    })}
                  </div>
                  {errors.selectedD17 && <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#ff4d6d' }}>{errors.selectedD17}</p>}
                </div>
              )}

              {/* Single number display (when only 1 number or non-d17 methods) */}
              {(method !== 'd17_number' || methodInfo.numbers?.length <= 1) && methodInfo.value && (
                <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: '1rem' }}>
                  <MonoLabel>
                    {method === 'd17_number'   ? 'Send to D17 Number' :
                     method === 'd17_address'  ? (methodInfo.address_label || 'D17 Address / RIB') :
                     method === 'bank_transfer' ? (methodInfo.bank_name ? `Bank Account - ${methodInfo.bank_name}` : 'Bank Account Number') :
                     'Flouci Phone Number'}
                  </MonoLabel>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-primary)', letterSpacing: '0.04em', wordBreak: 'break-all' }}>{methodInfo.value}</span>
                    <CopyBtn text={methodInfo.value} />
                  </div>
                </div>
              )}
              {methodInfo.instructions && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{methodInfo.instructions}</p>
                </div>
              )}
              {method === 'bank_transfer' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 9, padding: '8px 12px' }}>
                  <TbAlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#f59e0b' }}>
                    Frais virement bancaire : <strong>2.5 DT</strong> déduits du montant crédité.
                  </span>
                </div>
              )}
              <div>
                <MonoLabel>Amount Sent (DT)</MonoLabel>
                <input
                  type="number" min="1" step="0.01"
                  value={amountSent} onChange={e => setAmountSent(e.target.value)}
                  placeholder="How much did you send?"
                  style={errors.amountSent ? { borderColor: '#ff4d6d' } : {}}
                />
                {errors.amountSent && <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#ff4d6d' }}>{errors.amountSent}</p>}
              </div>
              <div>
                <MonoLabel>
                  {method === 'd17_number' || method === 'd17_address' ? 'D17 Reference / Auth Number' :
                   method === 'bank_transfer' ? 'Bank Transaction Reference' : 'Flouci Transaction ID'}
                </MonoLabel>
                <input
                  value={referenceCode} onChange={e => setReferenceCode(e.target.value)}
                  placeholder={method === 'bank_transfer' ? 'Bank transaction reference number' : 'Transaction ID / reference'}
                  style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em', ...(errors.referenceCode ? { borderColor: '#ff4d6d' } : {}) }}
                />
                {errors.referenceCode && <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#ff4d6d' }}>{errors.referenceCode}</p>}
              </div>
              <CreditPreview method={method} amountSent={amountSent} />
            </>
          )}

          {/* Proof upload */}
          <div>
            <MonoLabel>Proof {isTicket ? '(photo of all tickets)' : '(payment screenshot)'}</MonoLabel>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10,
              border: '1px dashed ' + (errors.proof ? '#ff4d6d' : proof ? '#3DDC84' : 'rgba(255,255,255,0.12)'),
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              background: proof ? 'rgba(61,220,132,0.05)' : 'transparent', transition: 'border-color 0.2s',
            }}>
              <TbUpload size={16} color={proof ? '#3DDC84' : errors.proof ? '#ff4d6d' : 'var(--text-muted)'} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: proof ? '#3DDC84' : errors.proof ? '#ff4d6d' : 'rgba(255,255,255,0.35)' }}>
                {proof ? proof.name : 'Upload image (required)'}
              </span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { setProof(e.target.files[0]); setErrors(v => ({ ...v, proof: undefined })) }} />
            </label>
            {errors.proof && <p style={{ margin: '4px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#ff4d6d' }}>{errors.proof}</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn-secondary" onClick={handleClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Submitting…' : isTicket && tickets.length > 1 ? `Submit ${tickets.length} Tickets` : 'Submit Request'}
              {!loading && <TbChevronRight size={13} />}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/* ── Gift Card Redeem Modal ──────────────────────────────────────────── */
function RedeemModal({ isOpen, onClose, onSuccess }) {
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(null)
  const toast = useToast()

  const handleRedeem = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const { data } = await redeemGiftCard({ code: code.trim().toUpperCase() })
      setDone(data)
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Redemption failed.')
    } finally { setLoading(false) }
  }

  const handleClose = () => { setCode(''); setDone(null); onClose() }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Redeem GMC Code" size="sm">
      {done ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <TbCircleCheck size={30} color="#3DDC84" />
          </div>
          <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)', margin: '0 0 4px' }}>Code Redeemed!</p>
          <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '2rem', color: '#3DDC84', margin: '0 0 6px' }}>+{done.amount} DT</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>
            New balance: <strong style={{ color: 'var(--text-primary)' }}>{done.balance} DT</strong>
          </p>
          <button className="btn-primary" onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>Done</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Enter your GMC gift card code to instantly credit your wallet.
          </p>
          <div>
            <MonoLabel>Gift Card Code</MonoLabel>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="GMC-XXXXXX"
              style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', fontSize: '1rem', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={handleClose} style={{ flex: 1 }}>Cancel</button>
            <button className="btn-primary" onClick={handleRedeem} disabled={loading || !code.trim()} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Redeeming…' : '⚡ Redeem'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}


/* ── Main page ───────────────────────────────────────────────────────── */
export default function WalletPage() {
  const { t } = useTranslation('wallet')
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [redeemOpen,   setRedeemOpen]   = useState(false)
  const qc = useQueryClient()

  const { data: walletData, isLoading } = useQuery({ queryKey: ['wallet'], queryFn: () => getWallet().then(r => r.data) })
  const { data: txData }                = useQuery({ queryKey: ['transactions'], queryFn: () => getTransactions().then(r => r.data) })
  const transactions = txData?.results || txData || []

  const balance = parseFloat(walletData?.balance || 0)
  const points  = walletData?.points || 0

  /* stats */
  const totalIn  = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0)
  const totalOut = transactions.filter(t => t.type === 'debit').reduce((s, t)  => s + parseFloat(t.amount || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />

      <div className='pb-nav' style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
        <div className="wallet-page-outer" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 2rem 4rem' }}>

          {/* ── Page header ─── */}
          <div style={{ marginBottom: '2rem', animation: 'fadeSlideUp 0.35s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TbWallet size={18} color="#3DDC84" />
              </div>
              <h1 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: '1.625rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{t('title')}</h1>
            </div>
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('subtitle')}</p>
          </div>

          {/* ── Hero balance card ─── */}
          <div className="wallet-hero" style={{
            position: 'relative', borderRadius: 20, overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f1f2e 0%, #0d1a14 50%, #0f0b1e 100%)',
            border: '1px solid var(--border)',
            padding: '2rem', marginBottom: '1rem',
            /* wallet-hero class targets this for mobile padding override */
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'fadeSlideUp 0.35s 0.05s ease both',
          }}>
            {/* glow orbs */}
            <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,220,132,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: 0, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div className="wallet-balance-row" style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              {/* Balance */}
              <div>
                <p style={{ margin: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(61,220,132,0.6)', textTransform: 'uppercase' }}>{t('balance.label')}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: 'clamp(1.75rem, 8vw, 3rem)', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {isLoading ? '-' : balance.toFixed(2)}
                  </span>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '1.25rem', color: '#3DDC84' }}>DT</span>
                </div>
                {/* mini stats row */}
                <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                  {[
                    { label: t('transactions.totalIn'),  value: '+' + formatCurrency(totalIn),  color: '#3DDC84' },
                    { label: t('transactions.totalOut'), value: '-' + formatCurrency(totalOut), color: '#ff4d6d' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                      <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.9375rem', color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Points + Recharge */}
              <div className="wallet-balance-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
                {/* Points pill */}
                <div style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 12, padding: '10px 16px', textAlign: 'right' }}>
                  <p style={{ margin: '0 0 2px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', textTransform: 'uppercase' }}>{t('balance.points')}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TbStar size={14} color="#f59e0b" />
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.375rem', color: 'var(--text-primary)' }}>{isLoading ? '-' : points}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</span>
                  </div>
                </div>
                {/* Recharge + Redeem buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => setRechargeOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', fontSize: '0.9375rem', fontWeight: 700 }}>
                    <TbPlus size={16} /> {t('recharge.title')}
                  </button>
                  <button onClick={() => setRedeemOpen(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                    borderRadius: 9, border: '1px solid rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                    cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: '0.875rem', fontWeight: 700,
                    transition: 'all 0.13s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
                  >
                    🎁 Redeem GMC Code
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mini trust strip ─── */}
          <div className="wallet-trust-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem', animation: 'fadeSlideUp 0.35s 0.1s ease both' }}>
            {[
              { Icon: TbShieldCheck, label: 'Secure',         desc: 'Encrypted transactions', color: '#7C3AED' },
              { Icon: TbBolt,        label: 'Instant Credit',  desc: 'After admin approval',   color: '#3DDC84' },
              { Icon: TbStar,        label: 'Earn Points',     desc: '+1 pt per DT spent',      color: '#f59e0b' },
            ].map(({ Icon, label, desc, color }) => (
              <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid ' + color + '18', borderRadius: 12, padding: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '14', border: '1px solid ' + color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={color} />
                </div>
                <div>
                  <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{label}</p>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Transactions ─── */}
          <div style={{ animation: 'fadeSlideUp 0.35s 0.15s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-primary)' }}>{t('transactions.title')}</h2>
                <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setRechargeOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9,
                background: 'rgba(61,220,132,0.08)', border: '1px solid rgba(61,220,132,0.2)',
                color: '#3DDC84', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.13s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,220,132,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(61,220,132,0.08)'}
              >
                <TbPlus size={14} /> {t('balance.addFunds')}
              </button>
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <TbWallet size={28} color="rgba(124,58,237,0.35)" />
                </div>
                <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>{t('transactions.noHistory')}</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>{t('recharge.title')}</p>
                <button onClick={() => setRechargeOpen(true)} className="btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
                  <TbPlus size={14} /> {t('recharge.title')}
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {transactions.map((tx, i) => {
                  const isCredit = tx.type === 'credit'
                  const color = isCredit ? '#3DDC84' : '#ff4d6d'
                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '0.9375rem 1.25rem',
                      borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      animation: 'fadeSlideUp 0.3s ' + (i * 0.03) + 's ease both',
                      transition: 'background 0.13s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* icon */}
                      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: color + '12', border: '1px solid ' + color + '25', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isCredit ? <TbArrowDown size={18} color={color} /> : <TbArrowUp size={18} color={color} />}
                      </div>
                      {/* info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.note || tx.method || (isCredit ? 'Wallet Recharge' : 'Purchase')}
                        </p>
                        <p style={{ margin: '2px 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</p>
                      </div>
                      {/* amount */}
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1rem', color, flexShrink: 0 }}>
                        {isCredit ? '+' : '-'}{tx.amount > 0 ? formatCurrency(tx.amount) : '0.00 DT'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>

      <RechargeModal isOpen={rechargeOpen} onClose={() => setRechargeOpen(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['wallet'] }); qc.invalidateQueries({ queryKey: ['transactions'] }) }} />
      <RedeemModal isOpen={redeemOpen} onClose={() => setRedeemOpen(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['wallet'] }); qc.invalidateQueries({ queryKey: ['transactions'] }) }} />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}



