import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { buttonClasses } from '@/components/ui/Button'

/** Customer pages: requires a signed-in user. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner label="Checking your session..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/**
 * Admin pages. The role comes from public.profiles (database), never from
 * the browser. This is only the UI gate - every admin query and write is
 * still blocked by Row Level Security (public.is_admin()) for non-admins.
 */
export function AdminRoute() {
  const { user, isAdmin, loading, profileError, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner label="Verifying access..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (profileError) {
    return <ErrorState title="Could not verify your access" message={profileError} onRetry={() => void refreshProfile()} />
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">Your account does not have permission to view the admin area.</p>
          <Link to="/" className={`${buttonClasses('primary')} mt-6`}>
            Back to store
          </Link>
        </div>
      </div>
    )
  }
  return <Outlet />
}

/** Login/register pages: signed-in users are sent away. */
export function GuestRoute() {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (user) {
    const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from
    const target = from ? `${from.pathname}${from.search ?? ''}` : isAdmin ? '/admin' : '/'
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
