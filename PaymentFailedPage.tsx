import { Link, useSearchParams } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getOrder } from '@/services/orders'
import { PayNowButton } from '@/components/orders/PayNowButton'
import { buttonClasses } from '@/components/ui/Button'
import { isPayableOnline } from '@/types/orders'
import { formatNaira } from '@/utils/format'

const COPY: Record<string, { title: string; text: string }> = {
  cancelled: { title: 'Payment cancelled', text: 'You cancelled the payment, so you have not been charged.' },
  failed: { title: 'Payment failed', text: 'Your payment was not successful and you have not been charged. This can happen if a card is declined or a bank transfer times out.' },
  error: { title: 'Something went wrong', text: 'We could not complete the payment.' },
}

export default function PaymentFailedPage() {
  usePageMeta({ title: 'Payment not completed' })
  const { user } = useAuth()
  const [params] = useSearchParams()
  const orderId = params.get('order')
  const reason = params.get('reason') ?? 'failed'
  const copy = COPY[reason] ?? COPY.failed

  const { data: order } = useAsync(() => (user && orderId ? getOrder(user.id, orderId) : Promise.resolve(null)), [user?.id, orderId])
  const canRetry = order ? isPayableOnline(order) : false

  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
          <XCircle className="h-9 w-9" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-gray-600">{copy.text}</p>

        {order && (
          <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            Order <strong>{order.order_number}</strong> ({formatNaira(order.total_amount)}) is {canRetry ? 'still waiting for payment, and your items are reserved for a short time.' : order.status === 'cancelled' ? 'cancelled.' : 'no longer payable.'}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {orderId && canRetry && <PayNowButton orderId={orderId} label="Try again" fullWidth />}
          <Link to="/cart" className={buttonClasses(canRetry ? 'outline' : 'primary', 'md', true)}>Return to cart</Link>
          {orderId && order && (
            <Link to={`/account/orders/${orderId}`} className="text-sm font-semibold text-brand-700 hover:underline">View order</Link>
          )}
        </div>
      </div>
    </div>
  )
}
