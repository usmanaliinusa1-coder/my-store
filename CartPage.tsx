import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ShoppingCart, Trash2 } from 'lucide-react'
import { usePageMeta } from '@/hooks/usePageMeta'
import { cartSubtotal, lineIssue, useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'
import { Button, buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProductPhoto } from '@/components/catalog/ProductImage'
import { QuantityStepper } from '@/components/catalog/QuantityStepper'
import { UnpaidOrdersNotice } from '@/components/orders/UnpaidOrdersNotice'
import { getErrorMessage } from '@/utils/errors'
import { formatNaira } from '@/utils/format'
import type { CartLine } from '@/types/catalog'

function CartRow({ line }: { line: CartLine }) {
  const busy = useCartStore((s) => Boolean(s.busy[line.productId]))
  const { setQuantity, remove } = useCartStore.getState()
  const issue = lineIssue(line)
  const product = line.product

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {product ? (
              <Link to={`/product/${product.slug}`} className="line-clamp-2 font-medium text-gray-900 hover:text-brand-700">
                {product.name}
              </Link>
            ) : (
              <p className="font-medium text-gray-500">Product unavailable</p>
            )}
            {product && <p className="text-sm text-gray-500">{formatNaira(product.price)} each</p>}
          </div>
          <button
            onClick={() => void run(() => remove(line.productId))}
            disabled={busy}
            aria-label={`Remove ${product?.name ?? 'item'} from cart`}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {issue && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {issue}
              {product && product.stock > 0 && line.quantity > product.stock && (
                <button onClick={() => void run(() => setQuantity(line.productId, product.stock))} className="ml-2 font-semibold underline">
                  Update to {product.stock}
                </button>
              )}
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {product && product.stock > 0 ? (
            <QuantityStepper
              value={Math.min(line.quantity, Math.max(product.stock, 1))}
              max={Math.min(product.stock, 100)}
              disabled={busy}
              onChange={(q) => void run(() => setQuantity(line.productId, q))}
            />
          ) : (
            <span />
          )}
          {product && <p className="text-base font-bold text-gray-900">{formatNaira(product.price * line.quantity)}</p>}
        </div>
      </div>
    </li>
  )
}

export default function CartPage() {
  usePageMeta({ title: 'Your cart' })
  const lines = useCartStore((s) => s.lines)
  const status = useCartStore((s) => s.status)
  const error = useCartStore((s) => s.error)

  // Always show fresh prices and stock from the database
  useEffect(() => {
    void useCartStore.getState().load()
  }, [])

  const reload = () => void useCartStore.getState().load()

  if (status === 'error' && lines.length === 0) {
    return <ErrorState title="Could not load your cart" message={error ?? undefined} onRetry={reload} />
  }

  if ((status === 'loading' || status === 'idle') && lines.length === 0) {
    return (
      <div className="container-page space-y-3 py-8" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-7 w-7" aria-hidden="true" />}
        title="Your cart is empty"
        message="Looks like you have not added anything yet."
        action={
          <Link to="/shop" className={buttonClasses('primary')}>
            Start shopping
          </Link>
        }
      />
    )
  }

  const subtotal = cartSubtotal(lines)
  const blocked = lines.some((l) => lineIssue(l) !== null)
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <div className="container-page py-6 sm:py-8">
      <UnpaidOrdersNotice className="mb-5" />
      <h1 className="mb-5 text-2xl font-extrabold text-gray-900 sm:text-3xl">
        Your cart <span className="text-base font-medium text-gray-500">({itemCount} item{itemCount === 1 ? '' : 's'})</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <ul className="space-y-3">
          {lines.map((line) => (
            <CartRow key={line.id} line={line} />
          ))}
        </ul>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-gray-900">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-semibold text-gray-900">{formatNaira(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Delivery</dt>
              <dd className="text-gray-500">Calculated at checkout</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-500">Final prices and stock are confirmed by our server when you place your order.</p>

          {blocked && (
            <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Fix or remove the highlighted items to continue.
            </p>
          )}

          <div className="mt-4 space-y-2">
            {blocked ? (
              <Button size="lg" fullWidth disabled>
                Proceed to checkout
              </Button>
            ) : (
              <Link to="/checkout" className={buttonClasses('primary', 'lg', true)}>
                Proceed to checkout
              </Link>
            )}
            <Link to="/shop" className={buttonClasses('outline', 'lg', true)}>
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
