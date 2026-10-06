import type { ReactNode } from 'react'
import type { ProductListItem } from '@/types/catalog'
import { ProductCard, ProductCardSkeleton } from './ProductCard'

const gridClass = 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <ul className={gridClass}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < 4} />
        </li>
      ))}
    </ul>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={gridClass} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
