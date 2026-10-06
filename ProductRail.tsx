import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useAsync'
import { getProductRail, type RailKind } from '@/services/catalog'
import { ProductGrid, ProductGridSkeleton, Section } from './ProductGrid'

interface ProductRailProps {
  title: string
  kind: RailKind
  limit?: number
  seeAllTo?: string
}

/** Home-page product section. Renders nothing when there are no matching products. */
export function ProductRail({ title, kind, limit = 4, seeAllTo = '/shop' }: ProductRailProps) {
  const { data, loading, error } = useAsync(() => getProductRail(kind, limit), [kind, limit])

  if (error || (!loading && (!data || data.length === 0))) return null

  return (
    <Section
      title={title}
      action={
        <Link to={seeAllTo} className="text-sm font-semibold text-brand-700 hover:underline">
          See all
        </Link>
      }
    >
      {loading || !data ? <ProductGridSkeleton count={limit} /> : <ProductGrid products={data} />}
    </Section>
  )
}
