import { useState } from 'react'
import { Button, type ButtonSize } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cancelUnpaidOrder } from '@/services/payments'
import { useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'

/** Cancels an unpaid online order so the reserved stock is released. */
export function CancelOrderButton({ orderId, onCancelled, size = 'md' }: { orderId: string; onCancelled: () => void; size?: ButtonSize }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await cancelUnpaidOrder(orderId)
      toast.success('Order cancelled')
      setOpen(false)
      void useCartStore.getState().load() // stock is back, refresh cart availability
      onCancelled()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <ConfirmDialog
        open={open}
        title="Cancel this order?"
        confirmLabel="Yes, cancel order"
        loading={busy}
        message="The items will be released and this order will no longer be payable. Your cart is not changed."
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      />
    </>
  )
}
