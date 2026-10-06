import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useShopActions } from '@/hooks/useShopActions'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { toast } from '@/store/toastStore'
import { Button, buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProductPhoto } from '@/components/catalog/ProductImage'
import { getErrorMessage } from '@/utils/errors'
import { formatNaira } from '@/utils/format'
import type { WishlistItem } from '@/types/catalog'

function WishlistRow({ item }: { item: WishlistItem }) {
  const { addToCart } = useShopActions()
  const busy = useWishlistStore((s) => Boolean(s.busy[item.productId]))
  const cartBusy = useCartStore((s) => Boolean(s.busy[item.productId]))
  const product = item.product
  const outOfStock = !product || product.stock < 1

  const removeItem = async () => {
    try {
      await useWishlistStore.getState().remove(item.productId)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const moveToCart = async () => {
    if (!(await addToCart(item.productId, 1))) return
    await removeItem()
  }

  return (
    <li className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:gap-4 sm:p-4">
      <div className="w-20 shrink-0 sm:w-28">
        {product ? (
          <Link to={`/product/${product.slug}`}>
            <ProductPhoto src={product.image_url} alt={product.name} className="rounded-xl" />
          </Link>
        ) : (
          <ProductPhoto src={null} alt="Unavailable product" className="rounded-xl" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {product ? (
          <>
            <Link to={`/product/${product.slug}`} className="line-clamp-2 font-medium text-gray-900 hover:text-brand-700">
              {product.name}
            </Link>
            <p className="font-bold text-gray-900">
              {formatNaira(product.price)}
              {product.compare_price !== null && product.compare_price > product.price && (
                <span className="ml-2 text-xs font-normal text-gray-400 line-through">{formatNaira(product.compare_price)}</span>
              )}
            </p>
            {product.stock < 1 && <p className="text-sm font-medium text-red-600">Out of stock</p>}
          </>
        ) : (
          <p className="font-medium text-gray-500">This product is no longer available.</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={outOfStock || busy} loading={cartBusy} onClick={() => void moveToCart()} leftIcon={<ShoppingCart className="h-4 w-4" />}>
            Move to cart
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void removeItem()} leftIcon={<Trash2 className="h-4 w-4" />}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  )
}

export default function WishlistPage() {
  usePageMeta({ title: 'Your wishlist' })
  const items = useWishlistStore((s) => s.items)
  const status = useWishlistStore((s) => s.status)
  const error = useWishlistStore((s) => s.error)

  useEffect(() => {
    void useWishlistStore.getState().load()
  }, [])

  const reload = () => void useWishlistStore.getState().load()

  if (status === 'error' && items.length === 0) {
    return <ErrorState title="Could not load your wishlist" message={error ?? undefined} onRetry={reload} />
  }

  if ((status === 'loading' || status === 'idle') && items.length === 0) {
    return (
      <div className="container-page space-y-3 py-8" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="h-7 w-7" aria-hidden="true" />}
        title="Your wishlist is empty"
        message="Tap the heart on any product to save it for later."
        action={
          <Link to="/shop" className={buttonClasses('primary')}>
            Browse products
          </Link>
        }
      />
    )
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-extrabold text-gray-900 sm:text-3xl">Your wishlist</h1>
      <ul className="mx-auto max-w-3xl space-y-3">
        {items.map((item) => (
          <WishlistRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}
