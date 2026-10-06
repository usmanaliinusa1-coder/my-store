import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getOrder } from '@/services/orders'
import { verifyPayment } from '@/services/payments'
import { useCartStore } from '@/store/cartStore'
import { PayNowButton } from '@/components/orders/PayNowButton'
import { Button, buttonClasses } from '@/components/ui/Button'
import { getErrorMessage } from '@/utils/errors'
import { formatNaira } from '@/utils/format'

type View =
  | { kind: 'verifying' }
  | { kind: 'success'; orderId: string; orderNumber: string; total: number; method: 'paystack' | 'cod'; duplicate?: boolean }
  | { kind: 'cancelled-paid'; orderId: string; orderNumber: string }
  | { kind: 'review'; orderNumber: string; orderId: string }
  | { kind: 'processing'; orderId: string; orderNumber: string }
  | { kind: 'awaiting'; orderId: string; orderNumber: string }
  | { kind: 'error'; message: string }

const POLL_MS = 4000
const MAX_POLLS = 5

function Shell({ tone, icon, title, children }: { tone: 'green' | 'amber' | 'red'; icon: ReactNode; title: string; children: ReactNode }) {
  const ring = tone === 'green' ? 'bg-green-100 text-green-600' : tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${ring}`}>{icon}</div>
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  )
}

export default function PaymentCallbackPage() {
  usePageMeta({ title: 'Payment' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref')
  const orderParam = params.get('order')
  const [view, setView] = useState<View>({ kind: 'verifying' })
  const polls = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const alive = useRef(true)

  const run = useCallback(async () => {
    if (!user) return
    setView((v) => (v.kind === 'processing' ? v : { kind: 'verifying' }))
    try {
      // A) Coming back from Paystack: our server verifies the reference with Paystack
      if (reference) {
        const r = await verifyPayment(reference)
        if (!alive.current) return
        switch (r.status) {
          case 'paid':
            void useCartStore.getState().load() // the server cleared the paid items from the cart
            setView(r.order_cancelled ? { kind: 'cancelled-paid', orderId: r.order_id, orderNumber: r.order_number } : { kind: 'success', orderId: r.order_id, orderNumber: r.order_number, total: r.total, method: 'paystack', duplicate: r.duplicate_payment })
            return
          case 'failed':
            navigate(`/payment/failed?order=${r.order_id}&reason=failed`, { replace: true })
            return
          case 'abandoned':
            navigate(`/payment/failed?order=${r.order_id}&reason=cancelled`, { replace: true })
            return
          case 'review':
            setView({ kind: 'review', orderId: r.order_id, orderNumber: r.order_number })
            return
          default:
            setView({ kind: 'processing', orderId: r.order_id, orderNumber: r.order_number })
            if (polls.current < MAX_POLLS) {
              polls.current += 1
              timer.current = window.setTimeout(() => void run(), POLL_MS)
            }
            return
        }
      }

      // B) Opened with only an order id (cash on delivery, or revisiting a finished order)
      if (orderParam) {
        const order = await getOrder(user.id, orderParam)
        if (!alive.current) return
        if (!order) {
          setView({ kind: 'error', message: 'We could not find that order.' })
          return
        }
        if (order.payment_status === 'paid' || order.payment_method === 'cod') {
          void useCartStore.getState().load()
          setView({ kind: 'success', orderId: order.id, orderNumber: order.order_number, total: order.total_amount, method: order.payment_method })
        } else {
          setView({ kind: 'awaiting', orderId: order.id, orderNumber: order.order_number })
        }
        return
      }

      setView({ kind: 'error', message: 'This page needs a payment reference. Please check your orders instead.' })
    } catch (err) {
      if (alive.current) setView({ kind: 'error', message: getErrorMessage(err) })
    }
  }, [user, reference, orderParam, navigate])

  useEffect(() => {
    alive.current = true
    polls.current = 0
    void run()
    return () => {
      alive.current = false
      window.clearTimeout(timer.current)
    }
  }, [run])

  const links = (orderId: string) => (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Link to={`/account/orders/${orderId}`} className={buttonClasses('primary')}>View order</Link>
      <Link to="/shop" className={buttonClasses('outline')}>Continue shopping</Link>
    </div>
  )

  switch (view.kind) {
    case 'verifying':
      return (
        <Shell tone="green" icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title="Confirming your payment...">
          <p className="mt-2 text-sm text-gray-600" role="status">Please do not close this page. This only takes a moment.</p>
        </Shell>
      )
    case 'success':
      return (
        <Shell tone="green" icon={<CheckCircle2 className="h-9 w-9" aria-hidden="true" />} title={view.method === 'cod' ? 'Order placed!' : 'Payment successful!'}>
          <p className="mt-2 text-sm text-gray-600">
            {view.method === 'cod' ? 'Thank you! Please have the cash ready when your order arrives.' : 'Thank you! We have received your payment and are preparing your order.'}
          </p>
          <dl className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
            <div className="flex justify-between"><dt className="text-gray-600">Order number</dt><dd className="font-bold text-gray-900">{view.orderNumber}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">{view.method === 'cod' ? 'Total to pay on delivery' : 'Total paid'}</dt><dd className="font-bold text-gray-900">{formatNaira(view.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">Payment</dt><dd className="font-semibold text-green-700">{view.method === 'cod' ? 'Cash on delivery' : 'Confirmed'}</dd></div>
          </dl>
          {view.duplicate && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">It looks like you paid more than once for this order. Our team will refund the extra payment.</p>}
          {links(view.orderId)}
        </Shell>
      )
    case 'cancelled-paid':
      return (
        <Shell tone="amber" icon={<AlertTriangle className="h-9 w-9" aria-hidden="true" />} title="Payment received for a cancelled order">
          <p className="mt-2 text-sm text-gray-600">Order <strong>{view.orderNumber}</strong> had already been cancelled. Your money was received and our team will refund it. Please contact support if you do not hear from us.</p>
          {links(view.orderId)}
        </Shell>
      )
    case 'review':
      return (
        <Shell tone="amber" icon={<AlertTriangle className="h-9 w-9" aria-hidden="true" />} title="We need to check your payment">
          <p className="mt-2 text-sm text-gray-600">Your payment for <strong>{view.orderNumber}</strong> was received but did not match the order total, so we have not confirmed it automatically. Our team will review it. Please contact support if you need help.</p>
          {links(view.orderId)}
        </Shell>
      )
    case 'processing':
      return (
        <Shell tone="amber" icon={<Clock className="h-9 w-9" aria-hidden="true" />} title="Your payment is still processing">
          <p className="mt-2 text-sm text-gray-600" role="status">Paystack has not finished processing order <strong>{view.orderNumber}</strong>. We are checking again. If money left your account, this will be confirmed automatically.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => { polls.current = 0; void run() }}>Check again</Button>
            <Link to={`/account/orders/${view.orderId}`} className={buttonClasses('outline')}>View order</Link>
          </div>
        </Shell>
      )
    case 'awaiting':
      return (
        <Shell tone="amber" icon={<Clock className="h-9 w-9" aria-hidden="true" />} title="Waiting for payment">
          <p className="mt-2 text-sm text-gray-600">Order <strong>{view.orderNumber}</strong> has not been paid yet.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <PayNowButton orderId={view.orderId} label="Pay now" />
            <Link to={`/account/orders/${view.orderId}`} className={buttonClasses('outline')}>View order</Link>
          </div>
        </Shell>
      )
    default:
      return (
        <Shell tone="red" icon={<AlertTriangle className="h-9 w-9" aria-hidden="true" />} title="We could not confirm your payment">
          <p role="alert" className="mt-2 text-sm text-gray-600">{view.message}</p>
          <p className="mt-2 text-sm text-gray-600">If money was taken from your account, do not pay again: it will be confirmed automatically, and you can check My orders.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {reference && <Button onClick={() => void run()}>Try again</Button>}
            <Link to="/account/orders" className={buttonClasses('outline')}>My orders</Link>
          </div>
        </Shell>
      )
  }
}
