import { ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ProductPhotoProps {
  src: string | null | undefined
  alt: string
  className?: string
  eager?: boolean
}

/** Square image with a lazy-loaded <img> and a neutral placeholder (no layout shift). */
export function ProductPhoto({ src, alt, className, eager }: ProductPhotoProps) {
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-gray-100', className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          width={600}
          height={600}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300" aria-label="No image">
          <ImageOff className="h-10 w-10" />
        </div>
      )}
    </div>
  )
}
