import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from './lib/queryClient'
import './index.css'
import './i18n'

import api from './api/index'
import useAuthStore from './store/authStore'
import Toast from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import ContactFab from './components/ContactFab'
import ReviewPromptModal from './components/ReviewPromptModal'
import BasketDrawer from './components/BasketDrawer'

// Customer pages
import ShopPage       from './pages/ShopPage'
import ProductPage    from './pages/ProductPage'
import RegisterPage   from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import OrdersPage     from './pages/OrdersPage'
import WalletPage     from './pages/WalletPage'
import SupportPage    from './pages/SupportPage'
import TicketDetailPage from './pages/TicketDetailPage'
import CheckoutPage   from './pages/CheckoutPage'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage'
import ProfilePage    from './pages/ProfilePage'
import BundlePage            from './pages/BundlePage'
import GamingAccountsPage   from './pages/GamingAccountsPage'
import OAuthCallbackPage    from './pages/OAuthCallbackPage'
import TermsPage            from './pages/TermsPage'
import NotFoundPage         from './pages/NotFoundPage'
import MaintenancePage      from './pages/MaintenancePage'

// Admin section
import AdminLayout      from './pages/admin/AdminLayout'
import DashboardPage    from './pages/admin/DashboardPage'
import AdminProductsPage from './pages/admin/ProductsPage'
import ProductMarginsPage from './pages/admin/ProductMarginsPage'
import AdminOrdersPage  from './pages/admin/OrdersPage'
import AdminUsersPage   from './pages/admin/UsersPage'
import RechargesPage    from './pages/admin/RechargesPage'
import OrderTicketsPage from './pages/admin/OrderTicketsPage'
import SupportTicketsPage from './pages/admin/SupportTicketsPage'
import BundlesPage      from './pages/admin/BundlesPage'
import PromoCodesPage   from './pages/admin/PromoCodesPage'
import FlashSalesPage   from './pages/admin/FlashSalesPage'
import CryptoPage       from './pages/admin/CryptoPage'
import SettingsPage     from './pages/admin/SettingsPage'
import GiftCardsPage    from './pages/admin/GiftCardsPage'
import CategoriesPage   from './pages/admin/CategoriesPage'

// -- Guards ----------------------------------------------------------------
function AuthRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated()) return <Navigate to="/" replace />
  return children
}

function AdminRoute({ children }) {
  const { accessToken, user } = useAuthStore()
  if (!accessToken) return <Navigate to="/" replace />
  // user may still be loading (null) - AppInit handles that; if loaded and not admin, redirect
  if (user && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

// -- Fetch current user on app start if token exists but user not loaded --
function AppInit({ children }) {
  const { accessToken, user, updateUser } = useAuthStore()
  const [ready, setReady] = useState(!!user || !accessToken)

  useEffect(() => {
    if (accessToken && !user) {
      api.get('/auth/me/')
        .then(r => updateUser(r.data))
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        })
        .finally(() => setReady(true))
    }
  }, [])

  if (!ready) return null
  return children
}

// -- Customer layout -------------------------------------------------------
function Layout({ children }) {
  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--bg-base)',
      flexDirection: 'column',
    }}>
      {children}
      <ContactFab />
      <ReviewPromptModal />
      <BasketDrawer />
    </div>
  )
}

const MAINTENANCE = import.meta.env.VITE_MAINTENANCE === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {MAINTENANCE ? <MaintenancePage /> : <AppInit>
          <Toast />
          <Routes>
            {/* Auth */}
            <Route path="/register"      element={<AuthRoute><RegisterPage /></AuthRoute>} />
            <Route path="/oauth/google"  element={<OAuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Customer */}
            <Route path="/"          element={<Layout><ShopPage /></Layout>} />
            <Route path="/product/:slug" element={<Layout><ProductPage /></Layout>} />
            <Route path="/bundle/:id" element={<Layout><BundlePage /></Layout>} />
            <Route path="/orders"    element={<Layout><ProtectedRoute><OrdersPage /></ProtectedRoute></Layout>} />
            {/* Notification links use /orders/<id> — same page, id available for future highlight */}
            <Route path="/orders/:id" element={<Layout><ProtectedRoute><OrdersPage /></ProtectedRoute></Layout>} />
            <Route path="/wallet"    element={<Layout><ProtectedRoute><WalletPage /></ProtectedRoute></Layout>} />
            <Route path="/checkout"  element={<Layout><ProtectedRoute><CheckoutPage /></ProtectedRoute></Layout>} />
            <Route path="/checkout/success" element={<Layout><ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute></Layout>} />
            <Route path="/support"   element={<Layout><ProtectedRoute><SupportPage /></ProtectedRoute></Layout>} />
            <Route path="/support/order/:id"   element={<Layout><ProtectedRoute><TicketDetailPage /></ProtectedRoute></Layout>} />
            <Route path="/support/general/:id" element={<Layout><ProtectedRoute><TicketDetailPage /></ProtectedRoute></Layout>} />
            <Route path="/profile"   element={<Layout><ProtectedRoute><ProfilePage /></ProtectedRoute></Layout>} />
            <Route path="/gaming-accounts" element={<GamingAccountsPage />} />
            <Route path="/terms"   element={<Layout><TermsPage /></Layout>} />
            <Route path="/privacy" element={<Layout><TermsPage /></Layout>} />

            {/* Admin - all under /admin, protected by AdminRoute, use AdminLayout */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index                element={<DashboardPage />} />
              <Route path="products"      element={<AdminProductsPage />} />
              <Route path="products/margins" element={<ProductMarginsPage />} />
              <Route path="categories"    element={<CategoriesPage />} />
              <Route path="bundles"       element={<BundlesPage />} />
              <Route path="flash-sales"   element={<FlashSalesPage />} />
              <Route path="promo-codes"   element={<PromoCodesPage />} />
              <Route path="orders"        element={<AdminOrdersPage />} />
              <Route path="users"         element={<AdminUsersPage />} />
              <Route path="recharges"     element={<RechargesPage />} />
              <Route path="crypto"        element={<CryptoPage />} />
              <Route path="gift-cards"    element={<GiftCardsPage />} />
              <Route path="order-tickets"   element={<OrderTicketsPage />} />
              <Route path="support-tickets" element={<SupportTicketsPage />} />
              <Route path="settings"      element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppInit>}
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
