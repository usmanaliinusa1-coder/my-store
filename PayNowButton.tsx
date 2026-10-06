import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard } from 'lucide-react'
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
import { initializePayment } from '@/services/payments'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'

interface PayNowButtonProps {
  orderId: string
  label?: string
  size?: ButtonSize
  variant?: ButtonVariant
  fullWidth?: boolean
}

/** Starts a fresh Paystack payment for an existing unpaid order (never creates a second order). */
export function PayNowButton({ orderId, label = 'Pay now', size = 'md', variant = 'primary', fullWidth }: PayNowButtonProps) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  // Android/Safari can restore this page from cache when the customer presses Back on Paystack
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setBusy(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const start = async () => {
    setBusy(true)
    try {
      const result = await initializePayment(orderId)
      if (result.kind === 'paid') {
        toast.success('This order is already paid.')
        navigate(`/payment/callback?order=${orderId}`)
        return
      }
      window.location.assign(result.url) // leaves the site; busy stays true on purpose
    } catch (err) {
      toast.error(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={variant} fullWidth={fullWidth} loading={busy} onClick={() => void start()} leftIcon={<CreditCard className="h-4 w-4" />}>
      {label}
    </Button>
  )
}
