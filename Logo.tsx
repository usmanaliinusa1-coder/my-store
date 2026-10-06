import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useSettingsStore, useStoreName } from '@/store/settingsStore'
import { cn } from '@/utils/cn'

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  const name = useStoreName()
  const logoUrl = useSettingsStore((s) => s.settings?.logo_url)

  return (
    <Link to="/" aria-label={`${name} home`} className={cn('flex items-center gap-2 font-extrabold tracking-tight', className)}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <span className={cn('text-lg', light ? 'text-white' : 'text-gray-900')}>{name}</span>
    </Link>
  )
}
