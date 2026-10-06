import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { getActiveCategories, queryProducts, type ProductSort } from '@/services/catalog'
import { Button, buttonClasses } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/FormControls'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/utils/cn'
import { ProductGrid, ProductGridSkeleton } from './ProductGrid'

const PAGE_SIZE = 12

const SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Best selling' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const parseSort = (v: string | null): ProductSort => (SORTS.some((s) => s.value === v) ? (v as ProductSort) : 'newest')

function parseMoney(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Search + filter + sort + paginated grid. All state lives in the URL
 * (shareable links, back button works). Data comes from Supabase one page at a time.
 */
export function ProductBrowser({ fixedCategorySlug }: { fixedCategorySlug?: string }) {
  const [params, setParams] = useSearchParams()

  const categorySlug = fixedCategorySlug ?? (params.get('category') || undefined)
  const q = params.get('q') ?? ''
  const sort = parseSort(params.get('sort'))
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1)
  const featured = params.get('featured') === '1'
  const inStock = params.get('instock') === '1'
  const min = parseMoney(params.get('min'))
  const max = parseMoney(params.get('max'))

  const [search, setSearch] = useState(q)
  const debouncedSearch = useDebounce(search, 400)
  const lastPushedQ = useRef(q)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [minInput, setMinInput] = useState(params.get('min') ?? '')
  const [maxInput, setMaxInput] = useState(params.get('max') ?? '')

  const update = useCallback(
    (patch: Record<string, string | null>, replace = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key)
            else next.set(key, value)
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  // typing in the search box -> URL (debounced)
  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (trimmed !== q.trim()) {
      lastPushedQ.current = trimmed
      update({ q: trimmed || null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // URL changed from outside (e.g. the header search) -> input
  useEffect(() => {
    if (q !== lastPushedQ.current) {
      lastPushedQ.current = q
      setSearch(q)
    }
  }, [q])

  const query = useMemo(
    () => ({ search: q, categorySlug, featuredOnly: featured, inStockOnly: inStock, minPrice: min, maxPrice: max, sort, page, pageSize: PAGE_SIZE }),
    [q, categorySlug, featured, inStock, min, max, sort, page],
  )
  const { data, loading, error, reload } = useAsync(() => queryProducts(query), [JSON.stringify(query)])
  const categories = useAsync(getActiveCategories, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const activeFilterCount = [featured, inStock, min !== undefined, max !== undefined].filter(Boolean).length
  const hasAnyFilter = activeFilterCount > 0 || q !== '' || (!fixedCategorySlug && Boolean(categorySlug))

  const applyPrice = (e: FormEvent) => {
    e.preventDefault()
    update({ min: parseMoney(minInput) !== undefined ? minInput : null, max: parseMoney(maxInput) !== undefined ? maxInput : null })
  }

  const clearAll = () => {
    setSearch('')
    setMinInput('')
    setMaxInput('')
    lastPushedQ.current = ''
    setParams({}, { replace: true })
  }

  const chipTo = (slug: string | null): string => {
    if (fixedCategorySlug) return slug ? `/category/${slug}` : '/shop'
    const next = new URLSearchParams(params)
    next.delete('page')
    if (slug) next.set('category', slug)
    else next.delete('category')
    const qs = next.toString()
    return qs ? `/shop?${qs}` : '/shop'
  }

  const chip = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    )

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="shop-search" className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id="shop-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-base placeholder:text-gray-400"
        />
      </form>

      <nav aria-label="Categories" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link to={chipTo(null)} className={chip(!categorySlug)} aria-current={!categorySlug ? 'page' : undefined}>
          All
        </Link>
        {(categories.data ?? []).map((c) => (
          <Link key={c.id} to={chipTo(c.slug)} className={chip(categorySlug === c.slug)} aria-current={categorySlug === c.slug ? 'page' : undefined}>
            {c.name}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600" aria-live="polite">
          {loading ? 'Loading...' : data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} leftIcon={<SlidersHorizontal className="h-4 w-4" />}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
          <label htmlFor="shop-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-3 animate-slide-down space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <form onSubmit={applyPrice} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="min-price" className="mb-1 block text-sm font-medium text-gray-700">
                Min price (₦)
              </label>
              <input id="min-price" inputMode="numeric" value={minInput} onChange={(e) => setMinInput(e.target.value.replace(/[^\d.]/g, ''))} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-base" placeholder="0" />
            </div>
            <div>
              <label htmlFor="max-price" className="mb-1 block text-sm font-medium text-gray-700">
                Max price (₦)
              </label>
              <input id="max-price" inputMode="numeric" value={maxInput} onChange={(e) => setMaxInput(e.target.value.replace(/[^\d.]/g, ''))} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-base" placeholder="Any" />
            </div>
            <Button type="submit" size="md" variant="secondary">
              Apply
            </Button>
          </form>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <CheckboxField label="Featured only" checked={featured} onChange={(e) => update({ featured: e.target.checked ? '1' : null })} />
            <CheckboxField label="In stock only" checked={inStock} onChange={(e) => update({ instock: e.target.checked ? '1' : null })} />
          </div>
        </div>
      )}

      {hasAnyFilter && (
        <div className="mt-3">
          <button onClick={clearAll} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            <X className="h-4 w-4" aria-hidden="true" /> Clear all filters
          </button>
        </div>
      )}

      <div className="mt-5">
        {error ? (
          <ErrorState title="Could not load products" message={error} onRetry={reload} />
        ) : loading && !data ? (
          <ProductGridSkeleton count={8} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-7 w-7" aria-hidden="true" />}
            title="No products found"
            message={hasAnyFilter ? 'Try a different search or clear your filters.' : 'New products are coming soon. Please check back later.'}
            action={
              hasAnyFilter ? (
                <button onClick={clearAll} className={buttonClasses('outline')}>
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : data ? (
          <div className={cn(loading && 'opacity-60 transition-opacity')}>
            <ProductGrid products={data.items} />
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: p > 1 ? String(p) : null }, false)} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
