import { lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import { Toaster } from '@/components/ui/Toaster'
import { ConfigErrorScreen } from '@/components/ConfigErrorScreen'
import { AdminRoute, GuestRoute, ProtectedRoute } from '@/components/routing/guards'
import { useCommerceSync } from '@/hooks/useCommerceSync'

import StoreLayout from '@/layouts/StoreLayout'
import AuthLayout from '@/layouts/AuthLayout'
import AdminLayout from '@/layouts/AdminLayout'

const HomePage = lazy(() => import('@/pages/HomePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const AccountPage = lazy(() => import('@/pages/account/AccountPage'))
const OrdersPage = lazy(() => import('@/pages/account/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/account/OrderDetailPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const PaymentCallbackPage = lazy(() => import('@/pages/PaymentCallbackPage'))
const PaymentFailedPage = lazy(() => import('@/pages/PaymentFailedPage'))
const ShopPage = lazy(() => import('@/pages/ShopPage'))
const CategoryPage = lazy(() => import('@/pages/CategoryPage'))
const ProductPage = lazy(() => import('@/pages/ProductPage'))
const CartPage = lazy(() => import('@/pages/CartPage'))
const WishlistPage = lazy(() => import('@/pages/WishlistPage'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage'))
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'))
const AdminProductFormPage = lazy(() => import('@/pages/admin/AdminProductFormPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load)
  useCommerceSync()

  useEffect(() => {
    if (isSupabaseConfigured) void loadSettings()
  }, [loadSettings])

  if (!isSupabaseConfigured) return <ConfigErrorScreen />

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Auth pages */}
        <Route element={<AuthLayout />}>
          <Route element={<GuestRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Must stay outside GuestRoute: the recovery link creates a session */}
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Storefront */}
        <Route element={<StoreLayout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="product/:slug" element={<ProductPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="cart" element={<CartPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="account/orders" element={<OrdersPage />} />
            <Route path="account/orders/:id" element={<OrderDetailPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="payment/callback" element={<PaymentCallbackPage />} />
            <Route path="payment/failed" element={<PaymentFailedPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin (UI gate here; real enforcement is Row Level Security) */}
        <Route path="admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductFormPage />} />
            <Route path="products/:id" element={<AdminProductFormPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="orders" element={<ComingSoonPage title="Orders" phase={6} />} />
            <Route path="customers" element={<ComingSoonPage title="Customers" phase={6} />} />
            <Route path="coupons" element={<ComingSoonPage title="Coupons" phase={6} />} />
            <Route path="settings" element={<ComingSoonPage title="Settings" phase={6} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}
