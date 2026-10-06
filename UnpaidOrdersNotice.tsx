import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listUnpaidOrders } from '@/services/orders'
import { formatNaira } from '@/utils/format'
import { CancelOrderButton } from './CancelOrderButton'
import { PayNowButton } from './PayNowButton'

/**
 * Unpaid online orders keep their items reserved. Show them (with Pay / Cancel) on the cart and
 * checkout pages so a customer is never stuck with items they "can't" re-order.
 */
export function UnpaidOrdersNotice({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data, reload } = useAsync(() => (user ? listUnpaidOrders(user.id) : Promise.resolve([])), [user?.id])

  if (!data || data.length === 0) return null

  return (
    <section aria-label="Unpaid orders" className={className}>
      <ul className="space-y-3">
        {data.map((o) => (
          <li key={o.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-start gap-2 text-sm text-amber-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Order <strong>{o.order_number}</strong> ({formatNaira(o.total_amount)}) is waiting for payment. Its items are reserved for you for a short time.
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PayNowButton orderId={o.id} label="Pay now" size="sm" />
              <Link to={`/account/orders/${o.id}`} className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                View order
              </Link>
              <CancelOrderButton orderId={o.id} size="sm" onCancelled={reload} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
