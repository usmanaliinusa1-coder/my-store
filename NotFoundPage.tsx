import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { buttonClasses } from '@/components/ui/Button'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <p className="text-7xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-gray-600">The page you are looking for does not exist or may have been moved.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className={buttonClasses('primary', 'lg')}>
          Go home
        </Link>
        <Link to="/shop" className={buttonClasses('outline', 'lg')}>
          Browse shop
        </Link>
      </div>
    </div>
  )
}
