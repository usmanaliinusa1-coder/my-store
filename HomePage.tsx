import { Link } from 'react-router-dom'
import { ShieldCheck, Truck, Wallet } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettingsStore, useStoreName } from '@/store/settingsStore'
import { BRAND } from '@/config/brand'
import { CategoryStrip } from '@/components/catalog/CategoryStrip'
import { ProductRail } from '@/components/catalog/ProductRail'

/** Landing page: hero, benefits, then live category and product sections from Supabase. */
export default function HomePage() {
  usePageTitle()
  const name = useStoreName()
  const tagline = useSettingsStore((s) => s.settings?.tagline) || BRAND.tagline

  return (
    <div className="container-page py-10 sm:py-16">
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-12 text-white sm:px-12 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Welcome to {name}</h1>
        <p className="mt-3 max-w-xl text-brand-50 sm:text-lg">{tagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/shop" className="inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold text-brand-700 hover:bg-brand-50">
            Start shopping
          </Link>
          <Link to="/register" className="inline-flex h-12 items-center rounded-lg border border-white/60 px-6 font-semibold text-white hover:bg-white/10">
            Create account
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Truck, title: 'Fast delivery', text: 'Nationwide delivery to your door.' },
          { icon: ShieldCheck, title: 'Secure payments', text: 'Pay safely online with Paystack.' },
          { icon: Wallet, title: 'Great prices', text: 'Everyday low prices and offers.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <CategoryStrip />
      <ProductRail title="Featured products" kind="featured" />
      <ProductRail title="New arrivals" kind="new" />
      <ProductRail title="Best sellers" kind="popular" />
      <ProductRail title="Deals and discounts" kind="discount" />
    </div>
  )
}
