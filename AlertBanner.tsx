import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/utils/cn'

const styles = {
  error: { cls: 'border-red-200 bg-red-50 text-red-800', Icon: AlertTriangle },
  success: { cls: 'border-green-200 bg-green-50 text-green-800', Icon: CheckCircle2 },
  info: { cls: 'border-blue-200 bg-blue-50 text-blue-800', Icon: Info },
}

export function AlertBanner({ variant = 'info', children }: { variant?: keyof typeof styles; children: ReactNode }) {
  const { cls, Icon } = styles[variant]
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
