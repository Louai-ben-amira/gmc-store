import { useNavigate, useLocation } from 'react-router-dom'
import { TbBrandWhatsapp, TbBrandInstagram, TbMessageCircle } from 'react-icons/tb'

const WHATSAPP_URL  = 'https://wa.me/21624027209'
const INSTAGRAM_URL = 'https://www.instagram.com/gmcvstorex'

const btnBase = {
  width: 46, height: 46, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', cursor: 'pointer', textDecoration: 'none',
  boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
}

function FabButton({ label, color, Icon, href, onClick }) {
  const style = { ...btnBase, background: color }
  const hover = e => { e.currentTarget.style.transform = 'scale(1.12)' }
  const leave = e => { e.currentTarget.style.transform = 'scale(1)' }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
         style={style} onMouseEnter={hover} onMouseLeave={leave}>
        <Icon size={26} color="#fff" />
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} title={label}
            style={style} onClick={onClick} onMouseEnter={hover} onMouseLeave={leave}>
      <Icon size={26} color="#fff" />
    </button>
  )
}

export default function ContactFab() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // The chat page has its own full-screen conversation UI
  if (pathname.startsWith('/messenger') || pathname.startsWith('/chat')) return null

  return (
    <div className="contact-fab" style={{
      position: 'fixed', right: 12,
      display: 'flex', flexDirection: 'column', gap: 12, zIndex: 95,
    }}>
      <FabButton label="Chat" color="var(--accent)" Icon={TbMessageCircle} onClick={() => navigate('/messenger')} />
      <FabButton label="WhatsApp" color="#25d366" Icon={TbBrandWhatsapp} href={WHATSAPP_URL} />
      <FabButton label="Instagram" Icon={TbBrandInstagram} href={INSTAGRAM_URL}
                 color="linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" />
    </div>
  )
}
