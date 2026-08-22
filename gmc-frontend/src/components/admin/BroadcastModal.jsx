import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, X, Send } from 'lucide-react'
import { getBroadcastAudience, sendBroadcast } from '../../api/notifications'
import { useToast } from '../../hooks/useToast'
import { T } from './AdminUI'

const TITLE_MAX = 100
const BODY_MAX  = 200

/**
 * Compose + send one announcement to every active user's notification bell.
 * Opened from the dashboard quick actions; self-contained so any admin page
 * can drop it in.
 */
export default function BroadcastModal({ open, onClose }) {
  const toast = useToast()
  const qc    = useQueryClient()

  const [title,   setTitle]   = useState('')
  const [body,    setBody]    = useState('')
  const [link,    setLink]    = useState('/')
  const [sending, setSending] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const { data: audience } = useQuery({
    queryKey: ['broadcast-audience'],
    queryFn: () => getBroadcastAudience().then(r => r.data.recipients),
    enabled: open,
  })

  if (!open) return null

  const recipients = audience ?? null
  const ready      = title.trim() && body.trim() && !sending

  const reset = () => { setTitle(''); setBody(''); setLink('/'); setConfirm(false) }

  const close = () => { reset(); onClose() }

  const send = async () => {
    setSending(true)
    try {
      const { data } = await sendBroadcast({
        title: title.trim(), body: body.trim(), link: link.trim() || '/',
      })
      toast.success(`Announcement sent to ${data.recipients} user${data.recipients === 1 ? '' : 's'}.`)
      qc.invalidateQueries({ queryKey: ['notifications'] })
      close()
    } catch (err) {
      const d = err.response?.data
      toast.error(d?.detail || d?.title?.[0] || d?.body?.[0] || d?.link?.[0] || 'Could not send the announcement.')
      setConfirm(false)
    } finally { setSending(false) }
  }

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(4px)',
      zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 22, width: '100%', maxWidth: 470, fontFamily: T.body,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Megaphone size={19} color={T.warning} />
            <span style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 19, color: T.textPrimary }}>
              New Announcement
            </span>
          </div>
          <button onClick={close} style={{
            background: 'rgba(155,79,237,0.10)', border: `1px solid ${T.border}`, borderRadius: 6,
            padding: '5px 7px', cursor: 'pointer', color: T.purpleText, display: 'flex',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Title */}
        <Field label="Title" count={`${title.length}/${TITLE_MAX}`} over={title.length > TITLE_MAX}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="🎉 Thank you, 1000 users!"
            autoFocus
            style={INPUT}
          />
        </Field>

        {/* Body */}
        <Field label="Message" count={`${body.length}/${BODY_MAX}`} over={body.length > BODY_MAX}>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder="We just hit 1000 users! Thank you for trusting GMC Store."
            rows={3}
            style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }}
          />
        </Field>

        {/* Link */}
        <Field label="Link (where a click goes)">
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="/"
            style={INPUT}
          />
          {link && !link.startsWith('/') && (
            <p style={{ margin: '5px 0 0', fontSize: 11.5, color: T.danger }}>
              Must be an internal path starting with “/”.
            </p>
          )}
        </Field>

        {/* Live preview - mirrors the bell dropdown row */}
        <div style={{ marginTop: 4, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, margin: '0 0 7px' }}>
            Preview
          </p>
          <div style={{
            display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 10,
            background: 'rgba(255,200,77,0.07)', borderLeft: '2px solid #FFC84D',
            border: `1px solid ${T.border}`, borderLeftColor: '#FFC84D', borderLeftWidth: 2,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0, fontSize: 14,
              background: 'rgba(255,200,77,0.12)', border: '1px solid rgba(255,200,77,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              📢
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, color: '#F0EEE6', fontWeight: 700, fontSize: 13 }}>
                {title.trim() || 'Your title appears here'}
              </p>
              <p style={{ margin: '2px 0 0', color: '#9E9C94', fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}>
                {body.trim() || 'Your message appears here'}
              </p>
              <p style={{ margin: '4px 0 0', color: '#6B6960', fontSize: 11 }}>just now</p>
            </div>
          </div>
        </div>

        {/* Audience */}
        <div style={{
          background: 'rgba(155,79,237,0.07)', border: `1px solid ${T.border}`,
          borderRadius: 9, padding: '10px 13px', marginBottom: 16,
          fontSize: 12.5, color: T.textSub,
        }}>
          Will be sent to{' '}
          <b style={{ color: T.textPrimary, fontFamily: T.mono }}>
            {recipients === null ? '…' : recipients.toLocaleString()}
          </b>{' '}
          active user{recipients === 1 ? '' : 's'}.
        </div>

        {/* Confirm step - broadcasts can't be recalled */}
        {confirm ? (
          <div style={{
            background: T.warningDim, border: `1px solid ${T.warningBorder}`,
            borderRadius: 10, padding: '13px 15px',
          }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: T.warning, lineHeight: 1.6 }}>
              This sends to <b>{recipients === null ? 'all' : recipients.toLocaleString()}</b> users
              right now and <b>cannot be undone</b>.
            </p>
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={() => setConfirm(false)} style={BTN_GHOST}>Back</button>
              <button onClick={send} disabled={sending} style={{
                ...BTN_PRIMARY, opacity: sending ? 0.6 : 1,
                cursor: sending ? 'default' : 'pointer',
              }}>
                <Send size={13} /> {sending ? 'Sending…' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 9 }}>
            <button onClick={close} style={BTN_GHOST}>Cancel</button>
            <button
              onClick={() => setConfirm(true)}
              disabled={!ready}
              style={{ ...BTN_PRIMARY, opacity: ready ? 1 : 0.5, cursor: ready ? 'pointer' : 'not-allowed' }}
            >
              <Megaphone size={13} /> Send to all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, count, over, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </label>
        {count && (
          <span style={{ fontFamily: T.mono, fontSize: 11, color: over ? T.danger : T.textMuted }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

const INPUT = {
  width: '100%', boxSizing: 'border-box', background: T.bgInput,
  border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 12px',
  color: T.textPrimary, fontSize: 13.5, fontFamily: T.body, outline: 'none',
}
const BTN_GHOST = {
  flex: 1, padding: '11px', borderRadius: 9, cursor: 'pointer',
  background: 'transparent', border: `1px solid ${T.border}`,
  color: T.textSub, fontSize: 13.5, fontWeight: 600,
}
const BTN_PRIMARY = {
  flex: 1, padding: '11px', borderRadius: 9, border: 'none',
  background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', color: '#fff',
  fontSize: 13.5, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}
