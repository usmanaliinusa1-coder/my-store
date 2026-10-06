import { cn } from '@/utils/cn'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/orders'

const PAYMENT: Record<PaymentStatus, { label: string; cls: string }> = {
  pending: { label: 'Awaiting payment', cls: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', cls: 'bg-green-100 text-green-800' },
  failed: { label: 'Payment failed', cls: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', cls: 'bg-gray-200 text-gray-700' },
}

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-gray-100 text-gray-700' },
  paid: { label: 'Paid', cls: 'bg-green-100 text-green-800' },
  processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Shipped', cls: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
}

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

export function PaymentStatusBadge({ status, method }: { status: PaymentStatus; method?: PaymentMethod }) {
  const s = method === 'cod' && status === 'pending' ? { label: 'Pay on delivery', cls: 'bg-amber-100 text-amber-800' } : PAYMENT[status]
  return <span className={cn(pill, s.cls)}>{s.label}</span>
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status]
  return <span className={cn(pill, s.cls)}>{s.label}</span>
}
