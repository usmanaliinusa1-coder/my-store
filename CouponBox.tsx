import { useState } from 'react'
import { Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { previewCoupon } from '@/services/orders'
import { getErrorMessage } from '@/utils/errors'
import { formatNaira } from '@/utils/format'

export interface AppliedCoupon {
  code: string
  discount: number
}

interface CouponBoxProps {
  subtotal: number
  applied: AppliedCoupon | null
  onApply: (coupon: AppliedCoupon) => void
  onRemove: () => void
  externalError?: string | null
  disabled?: boolean
}

export function CouponBox({ subtotal, applied, onApply, onRemove, externalError, disabled }: CouponBoxProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async () => {
    const value = code.trim().toUpperCase()
    if (!value) {
      setError('Enter a coupon code')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await previewCoupon(value, subtotal)
      if (r.valid && r.discount !== undefined) {
        onApply({ code: r.code ?? value, discount: r.discount })
        setCode('')
      } else {
        setError(r.message)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-green-800">
          <Tag className="h-4 w-4" aria-hidden="true" />
          <strong>{applied.code}</strong> applied: -{formatNaira(applied.discount)}
        </span>
        <button type="button" onClick={onRemove} disabled={disabled} aria-label="Remove coupon" className="rounded p-1 text-green-800 hover:bg-green-100 disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const message = error ?? externalError ?? null
  return (
    <div>
      <label htmlFor="coupon-code" className="mb-1.5 block text-sm font-medium text-gray-700">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void apply()
            }
          }}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={disabled}
          placeholder="Enter code"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? 'coupon-error' : undefined}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-base uppercase placeholder:normal-case"
        />
        <Button type="button" variant="secondary" onClick={() => void apply()} loading={busy} disabled={disabled}>
          Apply
        </Button>
      </div>
      {message && (
        <p id="coupon-error" role="alert" className="mt-1.5 text-sm text-red-600">
          {message}
        </p>
      )}
    </div>
  )
}
