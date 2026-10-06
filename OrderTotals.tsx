import { formatNaira } from '@/utils/format'

interface OrderTotalsProps {
  subtotal: number
  discount: number
  discountLabel?: string | null
  shipping: number | null // null = shown as "Calculated at checkout"
  total: number
  totalLabel?: string
}

export function OrderTotals({ subtotal, discount, discountLabel, shipping, total, totalLabel = 'Total' }: OrderTotalsProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-gray-600">Subtotal</dt>
        <dd className="font-medium text-gray-900">{formatNaira(subtotal)}</dd>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-green-700">
          <dt>Discount{discountLabel ? ` (${discountLabel})` : ''}</dt>
          <dd className="font-medium">-{formatNaira(discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-gray-600">Delivery</dt>
        <dd className="font-medium text-gray-900">{shipping === null ? 'Calculated at checkout' : shipping === 0 ? 'Free' : formatNaira(shipping)}</dd>
      </div>
      <div className="flex justify-between border-t border-gray-200 pt-3 text-base">
        <dt className="font-bold text-gray-900">{totalLabel}</dt>
        <dd className="font-extrabold text-gray-900">{formatNaira(total)}</dd>
      </div>
    </dl>
  )
}
