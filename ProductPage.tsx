import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Heart, ShoppingCart, Star, Zap } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useShopActions } from '@/hooks/useShopActions'
import { getProductBySlug, getRelatedProducts } from '@/services/catalog'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProductPhoto } from '@/components/catalog/ProductImage'
import { QuantityStepper } from '@/components/catalog/QuantityStepper'
import { ProductGrid, Section } from '@/components/catalog/ProductGrid'
import NotFoundPage from '@/pages/NotFoundPage'
import { cn } from '@/utils/cn'
import { formatNaira } from '@/utils/format'
import type { ProductImage } from '@/types/catalog'

function Gallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [images])
  const current = images[index] ?? images[0]

  return (
    <div>
      <ProductPhoto src={current?.url} alt={current?.alt_text || name} eager className="rounded-2xl border border-gray-200" />
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={cn('block h-16 w-16 overflow-hidden rounded-lg border-2', i === index ? 'border-brand-600' : 'border-transparent')}
              >
                <img src={img.url} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-2" aria-busy="true">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export default function ProductPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { addToCart, toggleWishlist } = useShopActions()
  const [quantity, setQuantity] = useState(1)

  const { data: product, loading, error, reload } = useAsync(() => getProductBySlug(slug), [slug])
  const related = useAsync(
    () => (product?.category_id ? getRelatedProducts(product.category_id, product.id, 4) : Promise.resolve([])),
    [product?.id, product?.category_id],
  )

  const cartBusy = useCartStore((s) => (product ? Boolean(s.busy[product.id]) : false))
  const saved = useWishlistStore((s) => (product ? s.ids.has(product.id) : false))

  useEffect(() => setQuantity(1), [product?.id])

  usePageMeta({
    title: product?.meta_title || product?.name,
    description: product?.meta_description || product?.description,
    image: product?.images[0]?.url,
  })

  if (loading) return <ProductSkeleton />
  if (error) return <ErrorState title="Could not load this product" message={error} onRetry={reload} />
  if (!product) return <NotFoundPage />

  const outOfStock = product.stock < 1
  const maxQty = Math.max(1, Math.min(product.stock, 100))
  const hasDiscount = product.compare_price !== null && product.compare_price > product.price

  const buyNow = async () => {
    if (await addToCart(product.id, quantity)) navigate('/checkout')
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <Link to="/shop" className="hover:text-brand-700">Shop</Link>
        {product.category && (
          <>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <Link to={`/category/${product.category.slug}`} className="hover:text-brand-700">{product.category.name}</Link>
          </>
        )}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="line-clamp-1 text-gray-800">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <Gallery images={product.images} name={product.name} />

        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">{product.name}</h1>

          {product.rating_count > 0 && (
            <p className="mt-2 flex items-center gap-1 text-sm text-gray-600">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              {Number(product.rating_avg).toFixed(1)} ({product.rating_count} review{product.rating_count === 1 ? '' : 's'})
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-extrabold text-gray-900">{formatNaira(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatNaira(product.compare_price as number)}</span>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-700">-{product.discount_percent}%</span>
              </>
            )}
          </div>

          <p className={cn('mt-3 text-sm font-semibold', outOfStock ? 'text-red-600' : product.stock <= 5 ? 'text-amber-600' : 'text-brand-700')}>
            {outOfStock ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock'}
          </p>

          {product.description && (
            <div className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Description</h2>
              <p className="mt-2 whitespace-pre-line text-base leading-7 text-gray-700">{product.description}</p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {!outOfStock && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <QuantityStepper value={quantity} max={maxQty} onChange={setQuantity} />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="flex-1 sm:flex-none sm:min-w-[11rem]" disabled={outOfStock} loading={cartBusy} onClick={() => void addToCart(product.id, quantity)} leftIcon={<ShoppingCart className="h-5 w-5" />}>
                Add to cart
              </Button>
              <Button size="lg" variant="secondary" className="flex-1 sm:flex-none sm:min-w-[11rem]" disabled={outOfStock} loading={cartBusy} onClick={() => void buyNow()} leftIcon={<Zap className="h-5 w-5" />}>
                Buy now
              </Button>
              <Button size="lg" variant="outline" onClick={() => void toggleWishlist(product.id)} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}>
                <Heart className={cn('h-5 w-5', saved && 'fill-red-500 text-red-500')} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {related.data && related.data.length > 0 && (
        <Section title="You may also like">
          <ProductGrid products={related.data} />
        </Section>
      )}
    </div>
  )
}
