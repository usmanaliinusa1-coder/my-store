import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { usePageMeta } from '@/hooks/usePageMeta'
import { getCategoryBySlug } from '@/services/catalog'
import { ProductBrowser } from '@/components/catalog/ProductBrowser'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageSpinner } from '@/components/ui/Spinner'
import NotFoundPage from '@/pages/NotFoundPage'

export default function CategoryPage() {
  const { slug = '' } = useParams()
  const { data: category, loading, error, reload } = useAsync(() => getCategoryBySlug(slug), [slug])

  usePageMeta({
    title: category?.name,
    description: category?.description ?? (category ? `Shop ${category.name}` : undefined),
    image: category?.image_url,
  })

  if (loading) return <PageSpinner />
  if (error) return <ErrorState title="Could not load this category" message={error} onRetry={reload} />
  if (!category) return <NotFoundPage />

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-gray-500">
        <Link to="/shop" className="hover:text-brand-700">
          Shop
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-gray-800">{category.name}</span>
      </nav>
      <div className="mb-5 flex items-center gap-4">
        {category.image_url && (
          <img src={category.image_url} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl border border-gray-200 object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{category.name}</h1>
          {category.description && <p className="mt-1 max-w-2xl text-sm text-gray-600">{category.description}</p>}
        </div>
      </div>
      <ProductBrowser key={category.slug} fixedCategorySlug={category.slug} />
    </div>
  )
}
