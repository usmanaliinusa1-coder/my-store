import { NavLink } from 'react-router-dom'
import { Heart, Home, ShoppingCart, Store, User } from 'lucide-react'
import { CountBadge } from '@/components/catalog/CountBadge'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/shop', label: 'Shop', icon: Store, end: false },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, end: false },
  { to: '/cart', label: 'Cart', icon: ShoppingCart, end: false },
  { to: '/account', label: 'Account', icon: User, end: false },
]

/** Sticky bottom navigation, mobile only. */
export function MobileBottomNav() {
  return (
    <nav
      aria-label="Bottom navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-700' : 'text-gray-500',
                )
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label === 'Cart' && <CountBadge kind="cart" />}
                {label === 'Wishlist' && <CountBadge kind="wishlist" />}
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
