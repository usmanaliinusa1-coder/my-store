import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Heart, LayoutDashboard, LogOut, Menu, Package, Search, ShoppingCart, User, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/store/toastStore'
import { Logo } from './Logo'
import { CountBadge } from '@/components/catalog/CountBadge'
import { buttonClasses } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

function SearchForm({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop')
  }

  return (
    <form onSubmit={onSubmit} role="search" className={className}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Search for products..."
          className="w-full rounded-full border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-4 text-base placeholder:text-gray-400 focus:bg-white md:text-sm"
        />
      </div>
    </form>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition-colors hover:text-brand-700', isActive ? 'text-brand-700' : 'text-gray-700')

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close menus when the route changes
  useEffect(() => {
    setDrawerOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // Close the user dropdown on outside click / Escape
  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUserMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  const handleSignOut = async () => {
    await signOut()
    toast.info('You have been logged out.')
    navigate('/', { replace: true })
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Account'

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="-ml-2 rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Logo />

        <nav aria-label="Main" className="ml-6 hidden items-center gap-6 lg:flex">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/shop" className={navLinkClass}>
            Shop
          </NavLink>
        </nav>

        <SearchForm className="mx-4 hidden max-w-xl flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link to="/wishlist" aria-label="Wishlist" className="hidden rounded-lg p-2 text-gray-700 hover:bg-gray-100 sm:block">
            <span className="relative inline-block"><Heart className="h-6 w-6" /><CountBadge kind="wishlist" /></span>
          </Link>
          <Link to="/cart" aria-label="Cart" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
            <span className="relative inline-block"><ShoppingCart className="h-6 w-6" /><CountBadge kind="cart" /></span>
          </Link>

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-2 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              >
                <User className="h-6 w-6" />
                <span className="hidden max-w-[7rem] truncate text-sm font-medium md:inline">{firstName}</span>
              </button>
              {userMenuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 animate-slide-down overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-gray-900">{profile?.full_name || 'Welcome'}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link role="menuitem" to="/account" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <User className="h-4 w-4" /> My account
                  </Link>
                  <Link role="menuitem" to="/account/orders" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Package className="h-4 w-4" /> My orders
                  </Link>
                  {isAdmin && (
                    <Link role="menuitem" to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                      <LayoutDashboard className="h-4 w-4" /> Admin dashboard
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:block">
                Log in
              </Link>
              <Link to="/register" className={cn(buttonClasses('primary', 'sm'), 'hidden sm:inline-flex')}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="container-page pb-3 md:hidden">
        <SearchForm />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
              <Logo />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3 text-gray-800" aria-label="Mobile">
              {[
                { to: '/', label: 'Home' },
                { to: '/shop', label: 'Shop' },
                { to: '/wishlist', label: 'Wishlist' },
                { to: '/cart', label: 'Cart' },
                { to: '/account', label: 'My account' },
                { to: '/account/orders', label: 'My orders' },
              ].map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    cn('block rounded-lg px-3 py-3 text-base font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50')
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              {isAdmin && (
                <Link to="/admin" className="block rounded-lg px-3 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50">
                  Admin dashboard
                </Link>
              )}
            </nav>
            <div className="safe-bottom border-t border-gray-200 p-4">
              {user ? (
                <button onClick={() => void handleSignOut()} className={buttonClasses('outline', 'md', true)}>
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/login" className={buttonClasses('outline')}>
                    Log in
                  </Link>
                  <Link to="/register" className={buttonClasses('primary')}>
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
