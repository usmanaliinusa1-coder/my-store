import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { PageSpinner } from '@/components/ui/Spinner'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-8 sm:justify-center">
      <div className="mb-6 flex w-full max-w-md items-center justify-between">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to store
        </Link>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
