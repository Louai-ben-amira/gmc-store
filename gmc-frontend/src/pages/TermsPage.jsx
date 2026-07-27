import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Topbar from '../components/Topbar'
import Footer from '../components/Footer'
import { TbShieldLock, TbReceiptRefund, TbAlertTriangle, TbCircleCheck, TbMail, TbClock } from 'react-icons/tb'

const EFFECTIVE_DATE = 'June 26, 2025'
const CONTACT_EMAIL  = 'support@gmcstore.tn'

/* ── Section heading ─────────────────────────────────────────────────── */
function SectionHeading({ icon: Icon, color = '#7C3AED', children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(139,79,219,0.18)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '18', border: '1px solid ' + color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <h2 style={{ margin: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        {children}
      </h2>
    </div>
  )
}

/* ── Policy card ─────────────────────────────────────────────────────── */
function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid rgba(139,79,219,0.18)',
      borderRadius: 16,
      padding: '1.5rem 1.75rem',
      marginBottom: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Bullet item ─────────────────────────────────────────────────────── */
function Bullet({ color = '#7C3AED', children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: '0.5rem', listStyle: 'none', padding: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 7 }} />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {children}
      </span>
    </li>
  )
}

/* ── Alert box ───────────────────────────────────────────────────────── */
function Alert({ color, Icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '1rem 1.25rem', borderRadius: 12, background: color + '0e', border: '1px solid ' + color + '30', marginBottom: '1rem' }}>
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {children}
      </p>
    </div>
  )
}

function Body({ children }) {
  return <p style={{ margin: '0 0 0.75rem', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{children}</p>
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Topbar />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

          {/* ── Hero header ── */}
          <div style={{ marginBottom: '2.5rem', animation: 'fadeSlideUp 0.35s ease both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,79,219,0.10)', border: '1px solid rgba(139,79,219,0.25)', borderRadius: 100, padding: '4px 14px', marginBottom: '1rem' }}>
              <TbShieldLock size={12} color="#B57BFF" />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B57BFF' }}>
                Legal · GMC Store
              </span>
            </div>
            <h1 style={{ margin: '0 0 0.5rem', fontFamily: 'Sora, sans-serif', fontWeight: 900, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Terms of Service &<br />Refund Policy
            </h1>
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
              Effective date: <strong style={{ color: 'var(--text-secondary)' }}>{EFFECTIVE_DATE}</strong>
              &nbsp;·&nbsp; GMC Store, Tunisia
            </p>
          </div>

          {/* ── Quick nav ── */}
          <Card style={{ marginBottom: '2rem', background: 'var(--bg-elevated)' }}>
            <p style={{ margin: '0 0 0.75rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>On this page</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['Acceptance', 'Products & Delivery', 'Payments & Wallet', 'Refund Policy', 'Prohibited Use', 'Privacy', 'Limitation of Liability', 'Contact'].map(label => (
                <a key={label} href={`#${label.toLowerCase().replace(/ &? ?/g, '-')}`} style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#B57BFF', textDecoration: 'none', background: 'rgba(139,79,219,0.1)', border: '1px solid rgba(139,79,219,0.2)', borderRadius: 6, padding: '3px 10px', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,79,219,0.1)'}
                >{label}</a>
              ))}
            </div>
          </Card>

          {/* ── 1. Acceptance ── */}
          <Card id="acceptance">
            <SectionHeading icon={TbCircleCheck}>1. Acceptance of Terms</SectionHeading>
            <Body>
              By accessing or using GMC Store (gmcstore.tn), placing any order, or creating an account, you agree to be bound by these Terms of Service and our Refund Policy. If you do not agree, do not use the site.
            </Body>
            <Body>
              We reserve the right to update these terms at any time. Continued use of the site after a change constitutes acceptance of the new terms. The effective date at the top of this page always reflects the latest revision.
            </Body>
          </Card>

          {/* ── 2. Products & Delivery ── */}
          <Card id="products-&-delivery">
            <SectionHeading icon={TbCircleCheck}>2. Products & Digital Delivery</SectionHeading>
            <Body>
              GMC Store sells exclusively digital goods: game top-up codes, gift cards, premium account credentials, internet packages, and bundles. All items are delivered electronically - no physical shipment takes place.
            </Body>
            <ul style={{ padding: 0, margin: '0 0 0.75rem' }}>
              <Bullet color="#3DDC84">Delivery is typically instant or within a few minutes of payment confirmation.</Bullet>
              <Bullet color="#3DDC84">For account-type products (login games), credentials are revealed inside your order page once the order is confirmed.</Bullet>
              <Bullet color="#f59e0b">Some orders may be held for manual review (fraud prevention). You will be notified via your order status.</Bullet>
              <Bullet color="#f59e0b">Stock availability is shown in real time; if a product goes out of stock after your payment, you will receive a full refund to your wallet.</Bullet>
            </ul>
            <Alert color="#7C3AED" Icon={TbAlertTriangle}>
              Digital codes and credentials are considered <strong>delivered</strong> the moment they are displayed on your order page. Screenshot or copy them immediately - we cannot recover a code that you have already viewed and then lost.
            </Alert>
          </Card>

          {/* ── 3. Payments & Wallet ── */}
          <Card id="payments-&-wallet">
            <SectionHeading icon={TbCircleCheck} color="#3DDC84">3. Payments & Wallet</SectionHeading>
            <Body>
              Purchases are made by loading credit into your GMC Wallet and then spending that credit. Accepted top-up methods include D17, BaridiMob, Dahabia, bank transfer, Ooredoo/Orange/Tunisie Telecom tickets, and cryptocurrency (USDT via Binance Pay).
            </Body>
            <ul style={{ padding: 0, margin: '0 0 0.75rem' }}>
              <Bullet color="#3DDC84">Wallet top-ups are subject to admin approval and may take up to 24 hours on weekends.</Bullet>
              <Bullet color="#3DDC84">All prices are quoted in Tunisian Dinar (TND / DT) unless otherwise stated.</Bullet>
              <Bullet color="#f59e0b">Promo codes and loyalty points cannot be exchanged for cash and have no monetary value outside the platform.</Bullet>
              <Bullet color="#f59e0b">We reserve the right to reverse wallet credits added fraudulently or by error.</Bullet>
            </ul>
          </Card>

          {/* ── 4. Refund Policy ── */}
          <Card id="refund-policy" style={{ borderColor: 'rgba(255,107,133,0.25)', background: 'rgba(255,107,133,0.03)' }}>
            <SectionHeading icon={TbReceiptRefund} color="#FF6B85">4. Refund Policy</SectionHeading>

            <Alert color="#FF6B85" Icon={TbAlertTriangle}>
              <strong>No refunds are issued for delivered digital codes or revealed credentials.</strong> Once a code or account password is shown on your order page, the product is considered delivered and consumed - we have no way to un-deliver a digital item.
            </Alert>

            <Body>
              Refunds <em>are</em> available in the following specific situations:
            </Body>
            <ul style={{ padding: 0, margin: '0 0 1rem' }}>
              <Bullet color="#3DDC84">The product was never delivered (order stuck in <em>Pending</em> for more than 48 hours with no admin action).</Bullet>
              <Bullet color="#3DDC84">The code delivered was invalid or already used, verified by our team within <strong>24 hours</strong> of delivery.</Bullet>
              <Bullet color="#3DDC84">A duplicate charge occurred due to a payment system error.</Bullet>
              <Bullet color="#3DDC84">The product went out of stock after your payment was accepted.</Bullet>
            </ul>

            <Body>
              Refunds are issued as wallet credit (not cash) unless a payment processor error is involved, in which case we will discuss a cash refund via the original payment method.
            </Body>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', marginTop: '0.5rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>How to request a refund</p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {[
                  'Open the order in question via My Orders.',
                  'Click "Open Ticket" to start an order ticket about that order.',
                  'Describe the issue clearly and attach any proof (screenshot of the invalid code, error message, etc.).',
                  'Our team will respond within 24 hours on business days.',
                ].map((step, i) => (
                  <li key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '0.375rem' }}>{step}</li>
                ))}
              </ol>
            </div>
          </Card>

          {/* ── 5. Prohibited Use ── */}
          <Card id="prohibited-use">
            <SectionHeading icon={TbAlertTriangle} color="#f59e0b">5. Prohibited Use</SectionHeading>
            <Body>You may not use GMC Store to:</Body>
            <ul style={{ padding: 0, margin: '0 0 0.75rem' }}>
              <Bullet color="#FF6B85">Resell purchased codes or accounts commercially without written permission.</Bullet>
              <Bullet color="#FF6B85">Submit fraudulent payment proofs or manipulate wallet balances.</Bullet>
              <Bullet color="#FF6B85">Create multiple accounts to exploit referral or promo systems.</Bullet>
              <Bullet color="#FF6B85">Attempt to reverse-engineer, scrape, or disrupt the platform.</Bullet>
              <Bullet color="#FF6B85">Purchase on behalf of sanctioned individuals or entities.</Bullet>
            </ul>
            <Body>
              Violation of these rules will result in immediate account suspension, reversal of any pending wallet balance, and potential legal action.
            </Body>
          </Card>

          {/* ── 6. Privacy ── */}
          <Card id="privacy">
            <SectionHeading icon={TbShieldLock}>6. Privacy</SectionHeading>
            <Body>
              We collect the minimum data necessary to operate the store: your name, email, order history, and payment references. We do not store card numbers. Payment proof images are stored securely and deleted after verification.
            </Body>
            <ul style={{ padding: 0, margin: '0 0 0.75rem' }}>
              <Bullet>We never sell your personal data to third parties.</Bullet>
              <Bullet>We may use your email to send order confirmations and security alerts.</Bullet>
              <Bullet>You may request deletion of your account and associated data at any time by contacting support.</Bullet>
            </ul>
          </Card>

          {/* ── 7. Limitation of Liability ── */}
          <Card id="limitation-of-liability">
            <SectionHeading icon={TbShieldLock} color="#f59e0b">7. Limitation of Liability</SectionHeading>
            <Body>
              GMC Store is a reseller of digital goods and acts as an intermediary between publishers and end users. We are not responsible for:
            </Body>
            <ul style={{ padding: 0, margin: '0 0 0.75rem' }}>
              <Bullet color="#f59e0b">Changes to game mechanics, bans, or account suspensions imposed by the original publisher after delivery.</Bullet>
              <Bullet color="#f59e0b">Service outages on third-party platforms (Steam, PlayStation Network, Riot, etc.).</Bullet>
              <Bullet color="#f59e0b">Loss of access to accounts if you change passwords or violate the original platform's ToS.</Bullet>
            </ul>
            <Body>
              Our total liability for any claim is limited to the amount you paid for the specific order in dispute.
            </Body>
          </Card>

          {/* ── 8. Contact ── */}
          <Card id="contact" style={{ background: 'linear-gradient(135deg, rgba(139,79,219,0.08) 0%, rgba(10,5,18,0) 100%)', borderColor: 'rgba(139,79,219,0.3)' }}>
            <SectionHeading icon={TbMail}>8. Contact Us</SectionHeading>
            <Body>
              Questions about these terms or a specific order? Reach us through:
            </Body>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, background: 'rgba(139,79,219,0.12)', border: '1px solid rgba(139,79,219,0.3)', color: '#B57BFF', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,79,219,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,79,219,0.12)'}
              >
                <TbMail size={14} /> {CONTACT_EMAIL}
              </a>
              <Link to="/support" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, background: 'rgba(61,220,132,0.08)', border: '1px solid rgba(61,220,132,0.25)', color: '#3DDC84', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(61,220,132,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(61,220,132,0.08)'}
              >
                <TbClock size={14} /> Support Tickets
              </Link>
            </div>
            <p style={{ margin: '1rem 0 0', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              We aim to respond within <strong style={{ color: 'var(--text-secondary)' }}>24 hours</strong> on business days. For urgent order issues, open a ticket from that order in My Orders.
            </p>
          </Card>

          {/* ── Bottom note ── */}
          <p style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2rem' }}>
            By using GMC Store you confirm you have read, understood, and agreed to these terms.
            <br />Last updated: {EFFECTIVE_DATE}
          </p>

        </div>
        <Footer />
      </div>
    </div>
  )
}
