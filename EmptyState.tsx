import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="rounded-full bg-gray-100 p-3 text-gray-500">{icon ?? <Inbox className="h-7 w-7" aria-hidden="true" />}</div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      {action}
    </div>
  )
}
