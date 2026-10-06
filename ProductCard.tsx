import { Link } from 'react-router-dom'
import { Check, ShoppingCart, Star } from 'lucide-react'
import { useShopActions } from '@/hooks/useShopActions'
import { useCartStore } from '@/store/cartStore'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatNaira } from '@/utils/format'
import type { ProductListItem } from '@/types/catalog'
import { ProductPhoto } from './ProductImage'
import { WishlistButton } from './WishlistButton'

export function ProductCard({ product, eager }: { product: ProductListItem; eager?: boolean }) {
  const { addToCart } = useShopActions()
  const busy = useCartStore((s) => Boolean(s.busy[product.id]))
  const inCart = useCartStore((s) => s.lines.some((l) => l.productId === product.id))
  const outOfStock = product.stock < 1
  const lowStock = !outOfStock && product.stock <= 5

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative">
        <Link to={`/product/${product.slug}`} aria-label={product.name} tabIndex={-1}>
          <ProductPhoto src={product.image_url} alt={product.name} eager={eager} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </Link>
        {product.discount_percent > 0 && !outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">-{product.discount_percent}%</span>
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-xs font-semibold text-white">Out of stock</span>
        )}
        <WishlistButton productId={product.id} className="absolute right-2 top-2" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-gray-900">
          <Link to={`/product/${product.slug}`} className="hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        {product.rating_count > 0 && (
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {Number(product.rating_avg).toFixed(1)} ({product.rating_count})
          </p>
        )}

        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-gray-900">{formatNaira(product.price)}</span>
          {product.compare_price !== null && product.compare_price > product.price && (
            <span className="text-xs text-gray-400 line-through">{formatNaira(product.compare_price)}</span>
          )}
        </div>

        {lowStock && <p className="text-xs font-medium text-amber-600">Only {product.stock} left</p>}

        <Button
          size="sm"
          variant={inCart ? 'outline' : 'primary'}
          className="mt-auto"
          fullWidth
          disabled={outOfStock}
          loading={busy}
          onClick={() => void addToCart(product.id, 1)}
          leftIcon={inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        >
          {outOfStock ? 'Unavailable' : inCart ? 'Add another' : 'Add to cart'}
        </Button>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
