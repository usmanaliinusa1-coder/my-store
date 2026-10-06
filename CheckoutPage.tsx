import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Check, CreditCard, Lock, MapPin, ShoppingCart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { usePageMeta } from '@/hooks/usePageMeta'
import { NIGERIAN_STATES } from '@/config/nigeria'
import { saveAddress, listAddresses } from '@/services/addresses'
import { createOrder, parseOrderError } from '@/services/orders'
import { initializePayment } from '@/services/payments'
import { cartSubtotal, lineIssue, useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { toast } from '@/store/toastStore'
import { CouponBox, type AppliedCoupon } from '@/components/checkout/CouponBox'
import { CancelOrderButton } from '@/components/orders/CancelOrderButton'
import { OrderTotals } from '@/components/orders/OrderTotals'
import { UnpaidOrdersNotice } from '@/components/orders/UnpaidOrdersNotice'
import { ProductPhoto } from '@/components/catalog/ProductImage'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Button, buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CheckboxField, SelectField } from '@/components/ui/FormControls'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextField } from '@/components/ui/TextField'
import { checkoutSchema, normalizePhone, type CheckoutFormValues } from '@/utils/checkoutSchemas'
import { estimateShipping } from '@/utils/checkout'
import { getErrorMessage } from '@/utils/errors'
import { formatNaira } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { PaymentMethod, SavedAddress } from '@/types/orders'

interface PendingOrder {
  orderId: string
  orderNumber: string
  total: number
  priceChanged: boolean
}

function Steps({ step }: { step: 1 | 2 }) {
  const item = (n: 1 | 2, label: string) => (
    <li className="flex items-center gap-2" aria-current={step === n ? 'step' : undefined}>
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold', step > n ? 'bg-brand-600 text-white' : step === n ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600')}>
        {step > n ? <Check className="h-4 w-4" aria-hidden="true" /> : n}
      </span>
      <span className={cn('text-sm font-semibold', step >= n ? 'text-gray-900' : 'text-gray-500')}>{label}</span>
    </li>
  )
  return (
    <ol className="mb-5 flex items-center gap-3">
      {item(1, 'Delivery')}
      <li aria-hidden="true" className="h-px w-8 bg-gray-300" />
      {item(2, 'Review and pay')}
    </ol>
  )
}

export default function CheckoutPage() {
  usePageMeta({ title: 'Checkout' })
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const lines = useCartStore((s) => s.lines)
  const cartStatus = useCartStore((s) => s.status)
  const settings = useSettingsStore((s) => s.settings)

  const [step, setStep] = useState<1 | 2>(1)
  const [method, setMethod] = useState<PaymentMethod>('paystack')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<PendingOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addresses = useAsync(() => (user ? listAddresses(user.id) : Promise.resolve([])), [user?.id])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const addressApplied = useRef(false)

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      contactName: profile?.full_name ?? '',
      contactPhone: profile?.phone ?? '',
      sameAsContact: true,
      recipientName: '',
      recipientPhone: '',
      address: '',
      city: '',
      state: '',
      landmark: '',
      saveAddress: true,
    },
  })
  const sameAsContact = watch('sameAsContact')

  // fresh prices + stock from the database
  useEffect(() => {
    void useCartStore.getState().load()
  }, [])

  // Android/Safari may restore this page from cache when the customer presses Back on Paystack
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setSubmitting(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const applyAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id)
    const contactName = getValues('contactName')
    const contactPhone = getValues('contactPhone')
    const same = a.full_name.trim().toLowerCase() === contactName.trim().toLowerCase() && normalizePhone(a.phone) === normalizePhone(contactPhone)
    setValue('sameAsContact', same)
    setValue('recipientName', same ? '' : a.full_name)
    setValue('recipientPhone', same ? '' : a.phone)
    setValue('address', a.address_line, { shouldValidate: true })
    setValue('city', a.city, { shouldValidate: true })
    setValue('state', a.state, { shouldValidate: true })
    setValue('landmark', a.landmark ?? '')
    setValue('saveAddress', false)
  }

  // pre-fill the default saved address once
  useEffect(() => {
    if (addressApplied.current || !addresses.data || addresses.data.length === 0) return
    addressApplied.current = true
    applyAddress(addresses.data.find((a) => a.is_default) ?? addresses.data[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data])

  const subtotal = cartSubtotal(lines)
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0
  const shipping = estimateShipping(subtotal - discount, settings)
  const expectedTotal = subtotal - discount + shipping
  const hasIssues = lines.some((l) => lineIssue(l) !== null)

  // ------------------------------------------------------------------ states
  if ((cartStatus === 'loading' || cartStatus === 'idle') && lines.length === 0) {
    return (
      <div className="container-page space-y-3 py-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (lines.length === 0 && !pending) {
    return (
      <div className="container-page py-6">
        <UnpaidOrdersNotice className="mx-auto mb-4 max-w-2xl" />
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" aria-hidden="true" />}
          title="Your cart is empty"
          message="Add something to your cart before checking out."
          action={
            <Link to="/shop" className={buttonClasses('primary')}>
              Start shopping
            </Link>
          }
        />
      </div>
    )
  }

  // ------------------------------------------------------------------ actions
  const startPayment = async (orderId: string) => {
    setError(null)
    setSubmitting(true)
    try {
      const result = await initializePayment(orderId)
      if (result.kind === 'paid') {
        navigate(`/payment/callback?order=${orderId}`, { replace: true })
        return
      }
      window.location.assign(result.url) // leave for Paystack; submitting stays true on purpose
    } catch (err) {
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  const placeOrder = async () => {
    if (submitting) return
    setError(null)
    setCouponError(null)
    setSubmitting(true)
    const v = getValues()
    const recipientName = v.sameAsContact ? v.contactName : v.recipientName
    const recipientPhone = v.sameAsContact ? v.contactPhone : v.recipientPhone

    try {
      // Only product ids + quantities leave the browser; the database prices everything.
      const order = await createOrder({
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        customerName: v.contactName,
        customerPhone: normalizePhone(v.contactPhone),
        shippingFullName: recipientName,
        shippingPhone: normalizePhone(recipientPhone),
        address: v.address,
        city: v.city,
        state: v.state,
        landmark: v.landmark,
        paymentMethod: method,
        couponCode: coupon?.code ?? null,
      })

      if (v.saveAddress && user) {
        void saveAddress(user.id, { fullName: recipientName, phone: normalizePhone(recipientPhone), address: v.address, city: v.city, state: v.state, landmark: v.landmark }).catch(() => undefined)
      }

      if (order.payment_method === 'cod') {
        await useCartStore.getState().load() // create_order cleared the cart for cash on delivery
        navigate(`/payment/callback?order=${order.order_id}`, { replace: true })
        return
      }

      const changed = Math.abs(order.total_amount - expectedTotal) > 0.009
      setPending({ orderId: order.order_id, orderNumber: order.order_number, total: order.total_amount, priceChanged: changed })
      if (changed) {
        setSubmitting(false) // let the customer confirm the new amount first
        return
      }
      await startPayment(order.order_id)
    } catch (err) {
      const e = parseOrderError(err)
      setSubmitting(false)
      if (e.code === 'COUPON_INVALID') {
        setCoupon(null)
        setCouponError(e.message)
      } else if (e.code === 'COD_DISABLED') {
        setMethod('paystack')
        setError(e.message)
      } else if (e.code === 'AUTH_REQUIRED') {
        navigate('/login', { state: { from: { pathname: '/checkout', search: '', hash: '', state: null, key: 'checkout' } } })
      } else {
        setError(e.message)
        if (e.code === 'INSUFFICIENT_STOCK' || e.code === 'PRODUCT_UNAVAILABLE') void useCartStore.getState().load()
      }
      toast.error(e.message)
    }
  }

  const onContinue = () => {
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ------------------------------------------------------------------ render
  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">Checkout</h1>
      <UnpaidOrdersNotice className="mb-5" />
      <Steps step={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* STEP 1 (kept mounted while hidden so typed values are never lost) */}
          <form onSubmit={handleSubmit(onContinue)} noValidate className={cn('space-y-5', step !== 1 && 'hidden')}>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <h2 className="mb-4 text-base font-bold text-gray-900">Your details</h2>
              <div className="space-y-4">
                <TextField label="Full name" autoComplete="name" error={errors.contactName?.message} {...register('contactName')} />
                <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="08012345678" error={errors.contactPhone?.message} {...register('contactPhone')} />
                <div>
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <p className="mt-1 rounded-lg bg-gray-50 px-3.5 py-3 text-base text-gray-700">{user?.email}</p>
                  <p className="mt-1 text-sm text-gray-500">Your receipt and payment confirmation are sent here.</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <MapPin className="h-5 w-5 text-brand-600" aria-hidden="true" /> Delivery address
              </h2>

              {addresses.data && addresses.data.length > 0 && (
                <fieldset className="mb-5">
                  <legend className="mb-2 text-sm font-medium text-gray-700">Saved addresses</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {addresses.data.map((a) => (
                      <label key={a.id} className={cn('cursor-pointer rounded-xl border p-3 text-sm', selectedAddressId === a.id ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                        <input type="radio" name="saved-address" className="sr-only" checked={selectedAddressId === a.id} onChange={() => applyAddress(a)} />
                        <span className="block font-semibold text-gray-900">{a.full_name}</span>
                        <span className="block text-gray-600">{a.address_line}, {a.city}, {a.state}</span>
                        <span className="block text-gray-500">{a.phone}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="space-y-4">
                <CheckboxField label="Deliver to me" description="Use my name and phone number for the delivery." {...register('sameAsContact')} />
                {!sameAsContact && (
                  <div className="space-y-4 rounded-xl bg-gray-50 p-3">
                    <TextField label="Recipient full name" autoComplete="off" error={errors.recipientName?.message} {...register('recipientName')} />
                    <TextField label="Recipient phone" type="tel" inputMode="tel" autoComplete="off" placeholder="08012345678" error={errors.recipientPhone?.message} {...register('recipientPhone')} />
                  </div>
                )}
                <TextField label="Street address" autoComplete="street-address" error={errors.address?.message} {...register('address')} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="City / Town" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
                  <SelectField label="State" error={errors.state?.message} {...register('state')}>
                    <option value="">Select state...</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
                <TextField label="Landmark (optional)" placeholder="Near the market, opposite the bank..." error={errors.landmark?.message} {...register('landmark')} />
                <CheckboxField label="Save this address for next time" {...register('saveAddress')} />
              </div>
            </section>

            <Button type="submit" size="lg" fullWidth>
              Continue to review and pay
            </Button>
          </form>

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">Deliver to</h2>
                  <button type="button" onClick={() => setStep(1)} disabled={submitting || pending !== null} className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50">
                    Edit
                  </button>
                </div>
                <p className="text-sm text-gray-700">
                  <strong>{getValues('sameAsContact') ? getValues('contactName') : getValues('recipientName')}</strong>
                  <br />
                  {getValues('address')}, {getValues('city')}, {getValues('state')}
                  {getValues('landmark') ? ` (${getValues('landmark')})` : ''}
                  <br />
                  {getValues('sameAsContact') ? getValues('contactPhone') : getValues('recipientPhone')}
                </p>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-base font-bold text-gray-900">Items ({lines.reduce((n, l) => n + l.quantity, 0)})</h2>
                <ul className="divide-y divide-gray-100">
                  {lines.map((l) => {
                    const issue = lineIssue(l)
                    return (
                      <li key={l.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="w-16 shrink-0">
                          <ProductPhoto src={l.product?.image_url} alt={l.product?.name ?? 'Unavailable product'} className="rounded-lg" />
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="line-clamp-2 font-medium text-gray-900">{l.product?.name ?? 'Product unavailable'}</p>
                          {l.product && <p className="text-gray-500">{l.quantity} x {formatNaira(l.product.price)}</p>}
                          {issue && <p role="alert" className="font-medium text-amber-700">{issue}</p>}
                        </div>
                        {l.product && <p className="text-sm font-bold text-gray-900">{formatNaira(l.product.price * l.quantity)}</p>}
                      </li>
                    )
                  })}
                </ul>
                {hasIssues && (
                  <div className="mt-3">
                    <AlertBanner variant="error">
                      Some items need attention. <Link to="/cart" className="font-semibold underline">Go to your cart</Link> to fix them.
                    </AlertBanner>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <CouponBox subtotal={subtotal} applied={coupon} disabled={submitting || pending !== null} externalError={couponError} onApply={(c) => { setCoupon(c); setCouponError(null) }} onRemove={() => setCoupon(null)} />
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                <fieldset disabled={submitting || pending !== null}>
                  <legend className="mb-3 text-base font-bold text-gray-900">Payment method</legend>
                  <div className="space-y-2">
                    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', method === 'paystack' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                      <input type="radio" name="payment-method" className="mt-1 h-4 w-4 text-brand-600" checked={method === 'paystack'} onChange={() => setMethod('paystack')} />
                      <span className="text-sm">
                        <span className="flex items-center gap-2 font-semibold text-gray-900"><CreditCard className="h-4 w-4" aria-hidden="true" /> Pay online with Paystack</span>
                        <span className="block text-gray-600">Card, bank transfer or USSD. Secure payment page by Paystack.</span>
                      </span>
                    </label>
                    {settings.cod_enabled && (
                      <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', method === 'cod' ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:bg-gray-50')}>
                        <input type="radio" name="payment-method" className="mt-1 h-4 w-4 text-brand-600" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                        <span className="text-sm">
                          <span className="flex items-center gap-2 font-semibold text-gray-900"><Banknote className="h-4 w-4" aria-hidden="true" /> Cash on delivery</span>
                          <span className="block text-gray-600">Pay in cash when your order arrives.</span>
                        </span>
                      </label>
                    )}
                  </div>
                </fieldset>
              </section>
            </>
          )}
        </div>

        {/* Summary */}
        <aside className="rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Order summary</h2>
          {step === 1 && (
            <ul className="mb-4 space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="line-clamp-1 text-gray-700">{l.quantity} x {l.product?.name ?? 'Unavailable'}</span>
                  {l.product && <span className="shrink-0 font-medium">{formatNaira(l.product.price * l.quantity)}</span>}
                </li>
              ))}
            </ul>
          )}
          <OrderTotals subtotal={subtotal} discount={discount} discountLabel={coupon?.code} shipping={shipping} total={pending ? pending.total : expectedTotal} totalLabel={pending ? 'Amount to pay' : 'Total'} />
          <p className="mt-3 text-xs text-gray-500">Final prices, stock, discount and delivery are confirmed by our server when you place the order.</p>

          {step === 2 && !pending && (
            <div className="mt-4 space-y-3">
              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              <Button size="lg" fullWidth loading={submitting} disabled={hasIssues} onClick={() => void placeOrder()} leftIcon={<Lock className="h-4 w-4" />}>
                {method === 'cod' ? 'Place order' : `Pay ${formatNaira(expectedTotal)}`}
              </Button>
              <p className="text-center text-xs text-gray-500">{method === 'cod' ? 'You will pay in cash on delivery.' : 'You will be redirected to Paystack to pay securely.'}</p>
            </div>
          )}

          {pending && (
            <div className="mt-4 space-y-3">
              <AlertBanner variant={pending.priceChanged ? 'info' : 'success'}>
                Order <strong>{pending.orderNumber}</strong> created.
                {pending.priceChanged ? ` The total changed to ${formatNaira(pending.total)} (prices or delivery were updated). Please confirm to pay.` : ' Your items are reserved while you pay.'}
              </AlertBanner>
              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              <Button size="lg" fullWidth loading={submitting} onClick={() => void startPayment(pending.orderId)} leftIcon={<Lock className="h-4 w-4" />}>
                {error ? 'Try payment again' : `Pay ${formatNaira(pending.total)}`}
              </Button>
              <div className="flex justify-center">
                <CancelOrderButton orderId={pending.orderId} size="sm" onCancelled={() => { setPending(null); setError(null) }} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
