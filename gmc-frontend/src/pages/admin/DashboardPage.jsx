import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getStats, getAdminOrders, getAdminRecharges, getAnalytics, getProducts } from '../../api/admin'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { RefreshCw } from 'lucide-react'

/* ── palette ── */
const CAT_COLORS = [
  'linear-gradient(90deg,#6D28D9,#9B4FED)',
  'linear-gradient(90deg,#6D28D9,#9B4FED)',
  'linear-gradient(90deg,#0F9D6B,#36FFC0)',
  'linear-gradient(90deg,#B8860B,#FFC84D)',
  'linear-gradient(90deg,#0891B2,#00CFFF)',
  'linear-gradient(90deg,#B84FED,#FF6BF5)',
]
const CAT_LABEL_COLORS = ['#B57BFF','#B57BFF','#36FFC0','#FFC84D','#00CFFF','#FF6BF5']

const METHOD_LABELS = {
  d17_number: 'D17 Phone', d17_address: 'D17 RIB', bank_transfer: 'Bank Transfer',
  flouci: 'Flouci', ooredoo_ticket: 'Ooredoo Ticket', orange_ticket: 'Orange Ticket',
  crypto: 'Crypto', edinar: 'E-Dinar', d17: 'D17 (legacy)', baridimob: 'BaridiMob', dahabia: 'Dahabia',
}
const ORDER_STATUS_META = {
  completed:           { label: 'Completed',        color: '#36FFC0' },
  paid_escrow:         { label: 'Paid - In Escrow',  color: '#B57BFF' },
  in_progress:         { label: 'In Progress',       color: '#00CFFF' },
  pending_credentials: { label: 'Pending Credentials', color: '#FFC84D' },
  pending:             { label: 'Pending',           color: '#FFC84D' },
  disputed:            { label: 'Disputed',          color: '#FF6B85' },
  cancelled:           { label: 'Cancelled',         color: '#FF6B85' },
  closed:              { label: 'Closed',            color: '#8A7AAE' },
}

/* ── SVG helpers ── */
function buildPath(pts, w, h) {
  if (pts.length < 2) return { line: '', area: '' }
  const max = Math.max(...pts, 1)
  const min = Math.min(...pts)
  const range = max - min || 1
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w)
  const ys = pts.map(v => h - ((v - min) / range) * (h - 6) - 3)
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return { line, area }
}

/* ── Revenue line chart with hover tooltip ── */
function RevenueChart({ data }) {
  const [hover, setHover] = useState(null)
  const W = 860, H = 170
  const pts = data.map(d => d.revenue)
  const { line, area } = buildPath(pts, W, H)
  if (!line) return <div style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '3rem 0' }}>No data yet</div>

  const max = Math.max(...pts, 1)
  const min = Math.min(...pts)
  const range = max - min || 1
  const xFor = i => (i / (data.length - 1)) * W
  const yFor = v => H - ((v - min) / range) * (H - 6) - 3

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  const h = hover != null ? data[hover] : null
  const hoverPct = hover != null ? (hover / (data.length - 1)) * 100 : 0

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: 'crosshair' }}>
        <defs>
          <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9B4FED" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#9B4FED" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="0" y1={H * 0.5}  x2={W} y2={H * 0.5}  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <path d={area} fill="url(#revfill)" />
        <path d={line} fill="none" stroke="#B57BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {hover != null && (
          <>
            <line x1={xFor(hover)} y1="0" x2={xFor(hover)} y2={H} stroke="rgba(181,123,255,0.35)" strokeWidth="1" />
            <circle cx={xFor(hover)} cy={yFor(data[hover].revenue)} r="4.5" fill="#B57BFF" stroke="#150C26" strokeWidth="2" />
          </>
        )}
      </svg>
      {h && (
        <div style={{
          position: 'absolute', top: 6, left: `${hoverPct}%`, transform: `translateX(${hoverPct > 75 ? '-105%' : '8px'})`,
          background: '#1E1233', border: '1px solid rgba(155,79,237,0.4)', borderRadius: 8, padding: '7px 11px',
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2, boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontSize: 10, color: '#8A7AAE', marginBottom: 2 }}>
            {new Date(h.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#B57BFF' }}>{formatCurrency(h.revenue)}</div>
          <div style={{ fontSize: 10, color: '#7A6A9E', marginTop: 1 }}>{h.orders} order{h.orders !== 1 ? 's' : ''}</div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
        {data.filter((_, i) => i % 7 === 0 || i === data.length - 1).map(d => (
          <span key={d.date} style={{ fontSize: 9, color: '#5E5078', fontFamily: "'JetBrains Mono',monospace" }}>
            {new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Mini bar chart (daily counts) ── */
function MiniBars({ data, color = '#00CFFF', height = 64 }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map(d => (
        <div key={d.date} title={`${new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} — ${d.count}`}
          style={{
            flex: 1, minWidth: 0, borderRadius: '3px 3px 0 0',
            height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 3)}%`,
            background: d.count > 0 ? color : 'rgba(255,255,255,0.06)',
            opacity: d.count > 0 ? 0.85 : 1,
          }} />
      ))}
    </div>
  )
}

/* ── Avatar initials ── */
function Avatar({ name = '', size = 28, gradient = 'linear-gradient(135deg,#6D28D9,#9B4FED)', style = {} }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0, ...style }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

const GRAD = [
  'linear-gradient(135deg,#6D28D9,#9B4FED)',
  'linear-gradient(135deg,#0F9D6B,#36FFC0)',
  'linear-gradient(135deg,#B8860B,#FFC84D)',
  'linear-gradient(135deg,#0891B2,#00CFFF)',
  'linear-gradient(135deg,#B84FED,#FF6BF5)',
  'linear-gradient(135deg,#DC2626,#FF6B85)',
  'linear-gradient(135deg,#B45309,#FBBF24)',
  'linear-gradient(135deg,#065F46,#34D399)',
]

/* ══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: stats     } = useQuery({ queryKey: ['admin-stats'],             queryFn: () => getStats().then(r => r.data) })
  const { data: analytics } = useQuery({ queryKey: ['admin-analytics'],         queryFn: () => getAnalytics().then(r => r.data), refetchInterval: 60000 })
  const { data: orders    } = useQuery({ queryKey: ['admin-orders-recent'],     queryFn: () => getAdminOrders({ page_size: 5 }).then(r => r.data) })
  const { data: recharges } = useQuery({ queryKey: ['admin-recharges-pending'], queryFn: () => getAdminRecharges({ status: 'pending' }).then(r => r.data) })
  const { data: products  } = useQuery({ queryKey: ['admin-products-stock'],    queryFn: () => getProducts({ ordering: 'stock_count', page_size: 8 }).then(r => r.data) })

  const recentOrders   = orders?.results    || []
  const pendingCharges = recharges?.results || recharges || []
  const rev            = analytics?.revenue
  const catData        = analytics?.by_category  || []
  const peakData       = analytics?.peak_hours   || []
  const bestSellers    = analytics?.best_sellers  || []
  const topClients     = analytics?.top_clients   || []
  const lowStockItems  = (products?.results || []).filter(p => (p.stock_count ?? 999) < 6).slice(0, 4)
  const maxCat         = catData.length ? Math.max(...catData.map(d => d.revenue)) : 1
  const dailyRev       = analytics?.daily_revenue   || []
  const rechargeAn     = analytics?.recharges       || null
  const userGrowth     = analytics?.users_growth    || null
  const ordersIns      = analytics?.orders_insights || null

  const vipTiers = useMemo(() => ({
    diamond: topClients.filter(c => c.total_spent >= 500).length,
    gold:    topClients.filter(c => c.total_spent >= 200 && c.total_spent < 500).length,
    silver:  topClients.filter(c => c.total_spent >= 50  && c.total_spent < 200).length,
    bronze:  topClients.filter(c => c.total_spent < 50).length,
  }), [topClients])

  const trendPts = peakData.map(h => h.orders)
  const { line: trendLine, area: trendArea } = buildPath(trendPts, 860, 160)

  const weekPts = dailyRev.slice(-14).map(d => d.revenue)
  const { line: sparkLine, area: sparkArea } = buildPath(weekPts, 420, 46)

  const growthPct = rev && rev.last_month > 0
    ? ((rev.this_month - rev.last_month) / rev.last_month) * 100
    : null

  function refresh() {
    ['admin-stats', 'admin-analytics', 'admin-orders-recent', 'admin-recharges-pending', 'admin-products-stock']
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  /* ── pulse items ── */
  const pulseItems = [
    recentOrders[0] && {
      dot: 'green',
      text: `Order #${recentOrders[0].id} - ${recentOrders[0].product_name || recentOrders[0].bundle_name || 'product'} · ${formatCurrency(recentOrders[0].amount_paid)}`
    },
    pendingCharges[0] && {
      dot: 'green',
      text: `${pendingCharges[0].user_username} requested recharge · ${formatCurrency(pendingCharges[0].amount_sent || 0)} via ${pendingCharges[0].method}`
    },
    lowStockItems.length > 0 && { dot: 'amber', text: `${lowStockItems.length} product${lowStockItems.length > 1 ? 's' : ''} low on stock` },
    stats?.pending_recharges > 0 && { dot: 'amber', text: `${stats.pending_recharges} pending recharge${stats.pending_recharges > 1 ? 's' : ''} awaiting review` },
  ].filter(Boolean)

  return (
    <div className="admin-dash-outer" style={{ flex: 1, overflowY: 'auto', background: '#0A0512', padding: '24px 28px', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* ── PULSE STRIP ── */}
        {pulseItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#130A20', border: '1px solid rgba(139,79,219,0.22)', borderRadius: 12, padding: '10px 18px', marginBottom: 22, overflowX: 'auto' }}>
            {pulseItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#B3A4D4', whiteSpace: 'nowrap' }}>
                {i > 0 && <span style={{ color: '#3D2F58' }}>·</span>}
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.dot === 'amber' ? '#FFC84D' : '#36FFC0', boxShadow: item.dot === 'amber' ? '0 0 8px rgba(255,200,77,0.6)' : '0 0 8px rgba(54,255,192,0.6)', flexShrink: 0, display: 'inline-block' }} />
                {item.text}
              </div>
            ))}
          </div>
        )}

        {/* ── PAGE HEADER ── */}
        <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 26, color: '#fff' }}>Dashboard</div>
            <div style={{ fontSize: 12, color: '#7A6A9E', marginTop: 2 }}>{today}</div>
          </div>
          <div className="admin-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => navigate('/admin/gift-cards')} style={QA_BTN}>🎁 Gift Card Batch</button>
            <button onClick={() => navigate('/admin/flash-sales')} style={QA_BTN}>🔥 Flash Sale</button>
            <button onClick={() => navigate('/admin/products')} style={{ ...QA_BTN, background: 'linear-gradient(135deg,#6D28D9,#9B4FED)', border: 'none', boxShadow: '0 6px 16px -6px rgba(124,58,237,0.6)' }}>+ Add Product</button>
            <button onClick={refresh} title="Refresh" style={{ ...QA_BTN, padding: '8px 10px' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Hero stat */}
          <div style={{ background: 'linear-gradient(135deg,#2A1050 0%,#190B2E 60%,#0E0818 100%)', border: '1px solid rgba(155,79,237,0.35)', borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, background: 'radial-gradient(circle,rgba(155,79,237,0.18),transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div>
                <div style={HERO_LABEL}>Monthly Revenue</div>
                <div style={HERO_VAL}>
                  {rev ? parseFloat(rev.this_month).toFixed(2) : '-'}
                  <span style={{ fontSize: 18, color: '#C39CF5', marginLeft: 4 }}>DT</span>
                </div>
              </div>
              {growthPct != null && (
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  ...(growthPct >= 0
                    ? { background: 'rgba(54,255,192,0.12)', border: '1px solid rgba(54,255,192,0.35)', color: '#36FFC0' }
                    : { background: 'rgba(255,68,102,0.12)', border: '1px solid rgba(255,68,102,0.35)', color: '#FF6B85' })
                }}>
                  {growthPct >= 0 ? '↑' : '↓'} {Math.abs(growthPct).toFixed(0)}% vs last month
                </div>
              )}
            </div>
            {/* Sparkline */}
            <div style={{ marginTop: 14, position: 'relative', zIndex: 1 }}>
              <svg width="100%" height="46" viewBox="0 0 420 46" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9B4FED" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#9B4FED" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {sparkLine && <><path d={sparkArea} fill="url(#sparkfill)" /><path d={sparkLine} fill="none" stroke="#B57BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>}
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 14, position: 'relative', zIndex: 1 }}>
              <div style={HERO_FOOT_ITEM}>This week <b style={{ color: '#fff', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{rev ? formatCurrency(rev.this_week) : '-'}</b></div>
              <div style={HERO_FOOT_ITEM}>Yesterday <b style={{ color: '#fff', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{rev ? formatCurrency(rev.yesterday) : '-'}</b></div>
              <div style={HERO_FOOT_ITEM}>Today <b style={{ color: '#fff', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{rev ? formatCurrency(rev.today) : '-'}</b></div>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={MINI_STAT}>
              <div style={{ ...MINI_ICON, background: 'rgba(155,79,237,0.14)' }}>🛒</div>
              <div>
                <div style={MINI_LABEL}>Total Orders</div>
                <div style={MINI_VAL}>{stats?.total_orders ?? '-'}</div>
              </div>
            </div>
            <div style={MINI_STAT}>
              <div style={{ ...MINI_ICON, background: 'rgba(255,200,77,0.14)' }}>💳</div>
              <div>
                <div style={MINI_LABEL}>Pending Recharges</div>
                {stats?.pending_recharges > 0
                  ? <div style={{ ...MINI_VAL, color: '#FFC84D' }}>{stats.pending_recharges} pending</div>
                  : <div style={{ ...MINI_VAL, fontSize: 14, color: '#36FFC0' }}>All clear ✓</div>
                }
              </div>
            </div>
            <div style={MINI_STAT}>
              <div style={{ ...MINI_ICON, background: 'rgba(54,255,192,0.10)' }}>👥</div>
              <div>
                <div style={MINI_LABEL}>Active Users</div>
                <div style={MINI_VAL}>{stats?.active_users ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-COL: Revenue 30d + Orders Insights ── */}
        <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Revenue — last 30 days */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>💰 Revenue — Last 30 Days</div>
                <div style={PANEL_SUB}>Daily revenue from completed orders · hover for detail</div>
              </div>
            </div>
            <RevenueChart data={dailyRev} />
          </div>

          {/* Orders insights */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>🧮 Orders Insights</div>
                <div style={PANEL_SUB}>Last 30 days</div>
              </div>
              <span onClick={() => navigate('/admin/orders')} style={PANEL_LINK}>View all →</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#B57BFF' }}>{ordersIns ? formatCurrency(ordersIns.aov) : '-'}</div>
                <div style={INS_TILE_LABEL}>Avg Order</div>
              </div>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#fff' }}>{ordersIns?.total ?? '-'}</div>
                <div style={INS_TILE_LABEL}>Orders</div>
              </div>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#FF6B85' }}>
                  {ordersIns?.total > 0
                    ? `${((((ordersIns.status_counts?.cancelled || 0) + (ordersIns.status_counts?.disputed || 0)) / ordersIns.total) * 100).toFixed(0)}%`
                    : '-'}
                </div>
                <div style={INS_TILE_LABEL}>Cancel Rate</div>
              </div>
            </div>

            {(() => {
              const entries = Object.entries(ordersIns?.status_counts || {}).sort((a, b) => b[1] - a[1])
              const maxStatus = entries.length ? entries[0][1] : 1
              return entries.length === 0
                ? <div style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '1.5rem 0' }}>No orders yet</div>
                : entries.map(([st, count], i) => {
                  const meta = ORDER_STATUS_META[st] || { label: st, color: '#8A7AAE' }
                  return (
                    <div key={st} style={{ marginBottom: i < entries.length - 1 ? 10 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{meta.label}</span>
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#B3A4D4' }}>{count}</span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count / maxStatus) * 100}%`, background: meta.color, opacity: 0.8, borderRadius: 4 }} />
                      </div>
                    </div>
                  )
                })
            })()}
          </div>
        </div>

        {/* ── 2-COL: Recharges + User Growth ── */}
        <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Recharges & wallet */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>💳 Recharges & Wallet</div>
                <div style={PANEL_SUB}>Money in · last 30 days</div>
              </div>
              <span onClick={() => navigate('/admin/recharges')} style={PANEL_LINK}>Manage →</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 24, color: '#36FFC0' }}>
                  {rechargeAn ? formatCurrency(rechargeAn.credited_this_month) : '-'}
                </div>
                <div style={{ fontSize: 10, color: '#7A6A9E', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>Credited this month</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'approved', label: 'Approved', color: '#36FFC0' },
                  { key: 'pending',  label: 'Pending',  color: '#FFC84D' },
                  { key: 'rejected', label: 'Rejected', color: '#FF6B85' },
                ].map(({ key, label, color }) => (
                  <span key={key} style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: `${color}1F`, border: `1px solid ${color}55`, color }}>
                    {label} {rechargeAn?.status_counts?.[key] ?? 0}
                  </span>
                ))}
              </div>
            </div>

            {(() => {
              const methods = rechargeAn?.by_method || []
              const maxCredited = methods.length ? Math.max(...methods.map(m => m.credited)) : 1
              return methods.length === 0
                ? <div style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '1.5rem 0' }}>No approved recharges yet</div>
                : methods.map((m, i) => (
                  <div key={m.method} style={{ marginBottom: i < methods.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{METHOD_LABELS[m.method] || m.method}</span>
                        <span style={{ fontSize: 10, color: '#7A6A9E', marginLeft: 6 }}>{m.count} recharge{m.count !== 1 ? 's' : ''}</span>
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 600, color: '#36FFC0' }}>{formatCurrency(m.credited)}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(m.credited / maxCredited) * 100}%`, background: 'linear-gradient(90deg,#0F9D6B,#36FFC0)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))
            })()}
          </div>

          {/* User growth */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>🚀 User Growth</div>
                <div style={PANEL_SUB}>Signups · last 30 days</div>
              </div>
              <span onClick={() => navigate('/admin/users')} style={PANEL_LINK}>View all →</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#fff' }}>{userGrowth?.total ?? '-'}</div>
                <div style={INS_TILE_LABEL}>Total Users</div>
              </div>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#00CFFF' }}>+{userGrowth?.new_this_month ?? '-'}</div>
                <div style={INS_TILE_LABEL}>New This Month</div>
              </div>
              <div style={INS_TILE}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: '#36FFC0' }}>{userGrowth?.buyers ?? '-'}</div>
                <div style={INS_TILE_LABEL}>Buyers</div>
              </div>
            </div>

            <MiniBars data={userGrowth?.daily_signups || []} color="#00CFFF" height={72} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {(userGrowth?.daily_signups || []).filter((_, i, arr) => i === 0 || i === arr.length - 1).map(d => (
                <span key={d.date} style={{ fontSize: 9, color: '#5E5078', fontFamily: "'JetBrains Mono',monospace" }}>
                  {new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2-COL: Trend + Top Clients ── */}
        <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Trend chart (peak hours) */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>📈 Orders by Hour</div>
                <div style={PANEL_SUB}>Last 30 days</div>
              </div>
            </div>
            <div style={{ padding: '4px 0' }}>
              <svg width="100%" height="160" viewBox="0 0 860 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9B4FED" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#9B4FED" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="40" x2="860" y2="40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <line x1="0" y1="80" x2="860" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <line x1="0" y1="120" x2="860" y2="120" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                {trendLine
                  ? <><path d={trendArea.replace('L860,160', `L${860},160`)} fill="url(#trendfill)" /><path d={trendLine} fill="none" stroke="#B57BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></>
                  : <text x="430" y="85" textAnchor="middle" fill="rgba(180,165,240,0.3)" fontSize="13">No data yet</text>
                }
              </svg>
              {/* X-axis labels */}
              {peakData.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
                  {[0, 4, 8, 12, 16, 20, 23].map(h => (
                    <span key={h} style={{ fontSize: 9, color: '#5E5078', fontFamily: "'JetBrains Mono',monospace" }}>{h}h</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top clients */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>🥇 Top Clients</div>
                <div style={PANEL_SUB}>By lifetime value</div>
              </div>
              <span onClick={() => navigate('/admin/users')} style={PANEL_LINK}>View all →</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {topClients.length === 0
                  ? <tr><td colSpan={3} style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '2rem 0' }}>No data yet</td></tr>
                  : topClients.slice(0, 5).map((c, i) => (
                    <tr key={i}>
                      <td style={{ padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar name={c.username} gradient={GRAD[i % GRAD.length]} />
                          <span style={{ color: '#fff', fontWeight: 500, fontSize: 12.5 }}>{c.username}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: '#7A6A9E', fontSize: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{c.orders} orders</td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 12.5, color: '#B57BFF', padding: '9px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{formatCurrency(c.total_spent)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 2-COL: Category bars + Stock Health ── */}
        <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>

          {/* Category bars */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>💜 Revenue by Category</div>
                <div style={PANEL_SUB}>All time · orders + revenue</div>
              </div>
            </div>
            {catData.length === 0
              ? <div style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '2rem 0' }}>No data yet</div>
              : catData.map((item, i) => (
                <div key={item.code || i} style={{ marginBottom: i < catData.length - 1 ? 13 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{item.category}</span>
                      <span style={{ fontSize: 10, color: '#7A6A9E', marginLeft: 6 }}>{item.orders} orders</span>
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 600, color: CAT_LABEL_COLORS[i % CAT_LABEL_COLORS.length] }}>{formatCurrency(item.revenue)}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(item.revenue / maxCat) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 4 }} />
                  </div>
                </div>
              ))
            }
          </div>

          {/* Stock Health + VIP */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div>
                <div style={PANEL_TITLE}>⚠️ Stock Health</div>
                <div style={PANEL_SUB}>Needs attention</div>
              </div>
              <span onClick={() => navigate('/admin/products')} style={PANEL_LINK}>Manage →</span>
            </div>

            {lowStockItems.length === 0
              ? <div style={{ color: '#36FFC0', fontSize: 12, marginBottom: 16 }}>All products well stocked ✓</div>
              : lowStockItems.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < lowStockItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(155,79,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                    {p.stock_count <= 2 ? '🔴' : '🟡'}
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                    ...(p.stock_count <= 2
                      ? { background: 'rgba(255,68,102,0.14)', border: '1px solid rgba(255,68,102,0.4)', color: '#FF6B85' }
                      : { background: 'rgba(255,184,0,0.14)', border: '1px solid rgba(255,184,0,0.4)', color: '#FFC84D' })
                  }}>
                    {p.stock_count} left
                  </span>
                </div>
              ))
            }

            {/* VIP Tiers */}
            <div style={{ marginTop: 18, marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#fff' }}>👥 Top Clients by Tier</div>
            <div className="admin-vip-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Bronze', count: vipTiers.bronze, cls: 'bronze' },
                { label: 'Silver', count: vipTiers.silver, cls: 'silver' },
                { label: 'Gold',   count: vipTiers.gold,   cls: 'gold'   },
                { label: 'Diamond', count: vipTiers.diamond, cls: 'diamond' },
              ].map(({ label, count, cls }) => {
                const colors = { bronze: { bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.3)', color: '#CD7F32' }, silver: { bg: 'rgba(192,192,192,0.08)', border: 'rgba(192,192,192,0.3)', color: '#C0C0C0' }, gold: { bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.3)', color: '#FFD700' }, diamond: { bg: 'rgba(0,207,255,0.08)', border: 'rgba(0,207,255,0.3)', color: '#00CFFF' } }
                const c = colors[cls]
                return (
                  <div key={label} style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}` }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 17, color: c.color }}>{count}</div>
                    <div style={{ fontSize: 9.5, color: '#8A7AAE', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 2-COL: Best Sellers + Recent Orders ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Best Sellers */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div style={PANEL_TITLE}>🔥 Best Sellers</div>
              <span onClick={() => navigate('/admin/products')} style={PANEL_LINK}>View all →</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Product', 'Units', 'Revenue'].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', fontSize: 10, color: '#7A6A9E', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 10, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestSellers.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '2rem 0' }}>No data yet</td></tr>
                  : bestSellers.map((item, i) => (
                    <tr key={i}>
                      <td style={TD}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: i < 3 ? ['#D4AF37','#A8A9AD','#CD7F32'][i] : '#5E5078' }}>#{i + 1}</span></td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(91,77,237,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🎮</div>
                          <span style={{ color: '#fff', fontWeight: 500, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.product}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', color: '#7A6A9E' }}>{item.units}</td>
                      <td style={{ ...TD, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#36FFC0' }}>{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* Recent Orders */}
          <div style={PANEL}>
            <div style={PANEL_HEAD}>
              <div style={PANEL_TITLE}>🧾 Recent Orders</div>
              <span onClick={() => navigate('/admin/orders')} style={PANEL_LINK}>View all →</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['User', 'Product', 'Amount', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 2 ? 'right' : 'left', fontSize: 10, color: '#7A6A9E', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 10, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0
                  ? <tr><td colSpan={4} style={{ textAlign: 'center', color: '#5E5078', fontSize: 12, padding: '2rem 0' }}>No orders yet</td></tr>
                  : recentOrders.map((o, i) => (
                    <tr key={o.id}>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={o.user_username || '?'} size={22} gradient={GRAD[i % GRAD.length]} />
                          <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 500 }}>{o.user_username || '-'}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#B3A4D4' }}>
                        {o.product_name || o.bundle_name || `#${o.product || o.bundle}`}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#36FFC0' }}>{formatCurrency(o.amount_paid)}</td>
                      <td style={TD}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: o.status === 'completed' ? 'rgba(54,255,192,0.12)' : 'rgba(255,184,0,0.12)', border: `1px solid ${o.status === 'completed' ? 'rgba(54,255,192,0.35)' : 'rgba(255,184,0,0.35)'}`, color: o.status === 'completed' ? '#36FFC0' : '#FFC84D', whiteSpace: 'nowrap' }}>
                          {o.status?.charAt(0).toUpperCase() + o.status?.slice(1) || '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ── style constants ── */
const PANEL      = { background: '#150C26', border: '1px solid rgba(139,79,219,0.22)', borderRadius: 14, padding: 18 }
const PANEL_HEAD = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const PANEL_TITLE = { fontSize: 14, fontWeight: 600, color: '#fff' }
const PANEL_SUB  = { fontSize: 11, color: '#7A6A9E', marginTop: 1 }
const PANEL_LINK = { fontSize: 11, color: '#C39CF5', cursor: 'pointer' }
const TD         = { padding: '9px 0', fontSize: 12.5, borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }
const HERO_LABEL = { fontSize: 11, color: '#B3A4D4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }
const HERO_VAL   = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 38, color: '#fff' }
const HERO_FOOT_ITEM = { fontSize: 11, color: '#8A7AAE' }
const MINI_STAT  = { flex: 1, background: '#150C26', border: '1px solid rgba(139,79,219,0.22)', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }
const MINI_ICON  = { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }
const MINI_LABEL = { fontSize: 10, color: '#7A6A9E', textTransform: 'uppercase', letterSpacing: '0.05em' }
const MINI_VAL   = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 1 }
const QA_BTN     = { fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(155,79,237,0.12)', border: '1px solid rgba(155,79,237,0.35)', padding: '8px 13px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }
const INS_TILE   = { textAlign: 'center', padding: '11px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
const INS_TILE_LABEL = { fontSize: 9, color: '#8A7AAE', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }
