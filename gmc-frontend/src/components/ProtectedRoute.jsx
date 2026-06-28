import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated()) {
      window.dispatchEvent(new CustomEvent('gmc:open-auth', { detail: { tab: 'login' } }))
      navigate('/', { replace: true })
    }
  }, [])

  if (!isAuthenticated()) return null
  return children
}
