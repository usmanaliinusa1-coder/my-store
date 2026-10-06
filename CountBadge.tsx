import { selectCartCount, useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'

/** Small red counter for the header / bottom nav icons. */
export function CountBadge({ kind }: { kind: 'cart' | 'wishlist' }) {
  const cart = useCartStore(selectCartCount)
  const wishlist = useWishlistStore((s) => s.ids.size)
  const count = kind === 'cart' ? cart : wishlist
  if (count < 1) return null
  return (
    <span
      aria-label={`${count} item${count === 1 ? '' : 's'}`}
      className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
