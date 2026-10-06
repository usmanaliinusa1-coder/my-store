import { usePageMeta } from '@/hooks/usePageMeta'
import { ProductBrowser } from '@/components/catalog/ProductBrowser'

export default function ShopPage() {
  usePageMeta({ title: 'Shop', description: 'Browse all products. Search, filter by category and price, and shop with secure payment.' })
  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-4 text-2xl font-extrabold text-gray-900 sm:text-3xl">Shop</h1>
      <ProductBrowser />
    </div>
  )
}
