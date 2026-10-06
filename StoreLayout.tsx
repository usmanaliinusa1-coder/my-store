import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { PageSpinner } from '@/components/ui/Spinner'

export default function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <a
        href="#main"
        className="sr-only z-[200] rounded-lg bg-white px-4 py-2 font-medium text-brand-700 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  )
}
