import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { EmptyState } from '@/components/ui/EmptyState'
import { buttonClasses } from '@/components/ui/Button'

/** Route placeholder for screens that are built in later phases. */
export default function ComingSoonPage({ title, phase }: { title: string; phase: number }) {
  usePageTitle(title)
  return (
    <EmptyState
      icon={<Construction className="h-7 w-7" aria-hidden="true" />}
      title={title}
      message={`This page is built in Phase ${phase} of the project.`}
      action={
        <Link to="/" className={buttonClasses('outline')}>
          Back to home
        </Link>
      }
    />
  )
}
