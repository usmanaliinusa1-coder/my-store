import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, Package, Settings, Tags, Ticket, Users, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/layout/Logo'
import { PageSpinner } from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package, end: false },
  { to: '/admin/categories', label: 'Categories', icon: Tags, end: false },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList, end: false },
  { to: '/admin/customers', label: 'Customers', icon: Users, end: false },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.info('You have been logged out.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full flex-col bg-gray-900 text-gray-200">
      <div className="flex h-16 items-center border-b border-gray-800 px-5">
        <Logo light />
      </div>
      <p className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Admin</p>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Admin">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="safe-bottom space-y-1 border-t border-gray-800 p-3">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-white">{profile?.full_name || 'Admin'}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
        </div>
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">
          <ExternalLink className="h-4 w-4" /> View store
        </Link>
        <button
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 hover:bg-gray-800"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open admin menu" className="-ml-2 rounded-lg p-2 text-gray-700 hover:bg-gray-100">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-gray-900">Admin</span>
        </header>

        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-slide-in-left shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="absolute right-2 top-3 z-10 rounded-lg p-2 text-gray-300 hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
