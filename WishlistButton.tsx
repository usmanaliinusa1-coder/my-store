import { Heart } from 'lucide-react'
import { useShopActions } from '@/hooks/useShopActions'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/utils/cn'

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { toggleWishlist } = useShopActions()
  const saved = useWishlistStore((s) => s.ids.has(productId))
  const busy = useWishlistStore((s) => Boolean(s.busy[productId]))

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void toggleWishlist(productId)
      }}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-colors hover:bg-white disabled:opacity-60',
        className,
      )}
    >
      <Heart className={cn('h-5 w-5', saved ? 'fill-red-500 text-red-500' : 'text-gray-600')} />
    </button>
  )
}
