import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const PLATFORM_TO_CAT = {
  steam: 'steam-accounts',
  epic:  'epic-games-accounts',
}

/* Legacy route - /gaming-accounts?platform=steam used to render a separate,
   out-of-sync product listing (wrong category slugs, no filters/pagination).
   The real listing lives at /?cat=<slug>, so just redirect there. */
export default function GamingAccountsPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()

  useEffect(() => {
    const platform = search.get('platform')
    const cat = PLATFORM_TO_CAT[platform] || 'game-accounts'
    navigate(`/?cat=${cat}`, { replace: true })
  }, [search, navigate])

  return null
}
