import { Link } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { getActiveCategories } from '@/services/catalog'
import { Skeleton } from '@/components/ui/Skeleton'
import { Section } from './ProductGrid'

/** Round category tiles for the home page. */
export function CategoryStrip() {
  const { data, loading, error } = useAsync(getActiveCategories, [])

  if (error || (!loading && (!data || data.length === 0))) return null

  return (
    <Section title="Shop by category">
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {loading || !data
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </li>
            ))
          : data.map((c) => (
              <li key={c.id} className="w-20 shrink-0">
                <Link to={`/category/${c.slug}`} className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-brand-50 text-brand-700">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <Tag className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium text-gray-800">{c.name}</span>
                </Link>
              </li>
            ))}
      </ul>
    </Section>
  )
}
