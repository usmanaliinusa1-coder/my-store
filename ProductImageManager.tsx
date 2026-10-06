import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { uploadImage, validateImageFile } from '@/lib/storage'
import { uuid } from '@/utils/uuid'
import { addProductImage, deleteProductImage, mapCatalogError, setPrimaryImage } from '@/services/adminCatalog'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import type { ProductImage } from '@/types/catalog'

export const MAX_PRODUCT_IMAGES = 8

/** A picture chosen on the "new product" form, uploaded after the product row exists. */
export interface StagedImage {
  key: string
  file: File
  previewUrl: string
}

interface Props {
  /** null while creating a product (images are staged, then uploaded on save). */
  productId: string | null
  initialImages: ProductImage[]
  staged: StagedImage[]
  stagedMainKey: string | null
  onStagedChange: (next: StagedImage[], mainKey: string | null) => void
}

export function ProductImageManager({ productId, initialImages, staged, stagedMainKey, onStagedChange }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const stagedRef = useRef(staged)
  stagedRef.current = staged

  useEffect(
    () => () => {
      stagedRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl))
    },
    [],
  )

  const total = productId === null ? staged.length : images.length
  const effectiveMainKey = stagedMainKey ?? staged[0]?.key ?? null

  const handleFiles = async (fileList: FileList | null) => {
    const picked = Array.from(fileList ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (picked.length === 0) return

    const room = MAX_PRODUCT_IMAGES - total
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_PRODUCT_IMAGES} images per product.`)
      return
    }
    if (picked.length > room) toast.info(`Only ${room} more image${room === 1 ? '' : 's'} can be added.`)

    const valid: File[] = []
    for (const file of picked.slice(0, room)) {
      const problem = validateImageFile(file)
      if (problem) toast.error(problem)
      else valid.push(file)
    }
    if (valid.length === 0) return

    // Creating a product: keep the files until the product row exists
    if (productId === null) {
      const added: StagedImage[] = valid.map((file) => ({ key: uuid(), file, previewUrl: URL.createObjectURL(file) }))
      onStagedChange([...staged, ...added], effectiveMainKey ?? added[0].key)
      return
    }

    // Editing: upload now, straight into the product-images bucket (admin-only by storage RLS)
    setBusy(true)
    let current = images
    try {
      for (const file of valid) {
        const uploaded = await uploadImage(file, `products/${productId}`)
        const row = await addProductImage({
          productId,
          url: uploaded.url,
          storagePath: uploaded.path,
          sortOrder: current.length,
          isPrimary: current.length === 0,
        })
        current = [...current, row]
        setImages(current)
      }
      toast.success(valid.length > 1 ? 'Images uploaded' : 'Image uploaded')
    } catch (err) {
      toast.error(mapCatalogError(err))
    } finally {
      setBusy(false)
    }
  }

  const makeMainSaved = async (image: ProductImage) => {
    if (productId === null) return
    setBusy(true)
    try {
      await setPrimaryImage(productId, image.id)
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === image.id })))
      toast.success('Main image updated')
    } catch (err) {
      toast.error(mapCatalogError(err))
    } finally {
      setBusy(false)
    }
  }

  const removeSaved = async (image: ProductImage) => {
    if (productId === null) return
    setBusy(true)
    try {
      await deleteProductImage(image)
      let rest = images.filter((i) => i.id !== image.id)
      if (image.is_primary && rest.length > 0) {
        await setPrimaryImage(productId, rest[0].id)
        rest = rest.map((i, idx) => ({ ...i, is_primary: idx === 0 }))
      }
      setImages(rest)
      toast.success('Image deleted')
    } catch (err) {
      toast.error(mapCatalogError(err))
    } finally {
      setBusy(false)
    }
  }

  const removeStaged = (key: string) => {
    const target = staged.find((s) => s.key === key)
    if (target) URL.revokeObjectURL(target.previewUrl)
    const rest = staged.filter((s) => s.key !== key)
    onStagedChange(rest, effectiveMainKey === key ? (rest[0]?.key ?? null) : effectiveMainKey)
  }

  const tiles =
    productId === null
      ? staged.map((s) => ({ id: s.key, url: s.previewUrl, isMain: s.key === effectiveMainKey }))
      : images.map((i) => ({ id: i.id, url: i.url, isMain: i.is_primary }))

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.id} className={cn('overflow-hidden rounded-xl border-2 bg-white', tile.isMain ? 'border-brand-600' : 'border-gray-200')}>
            <div className="relative aspect-square bg-gray-100">
              <img src={tile.url} alt="Product" width={300} height={300} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              {tile.isMain && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                  <Star className="h-3 w-3 fill-white" aria-hidden="true" /> Main
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 p-1.5">
              {tile.isMain ? (
                <span className="px-2 text-xs text-gray-500">Main image</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (productId === null ? onStagedChange(staged, tile.id) : void makeMainSaved(images.find((i) => i.id === tile.id) as ProductImage))}
                  className="rounded-md px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  Make main
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label="Delete image"
                onClick={() => (productId === null ? removeStaged(tile.id) : void removeSaved(images.find((i) => i.id === tile.id) as ProductImage))}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}

        {total < MAX_PRODUCT_IMAGES && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
            >
              <ImagePlus className="h-7 w-7" aria-hidden="true" />
              {busy ? 'Uploading...' : 'Add images'}
            </button>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="sr-only"
        aria-label="Choose product images"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-gray-500">
        Up to {MAX_PRODUCT_IMAGES} images (JPG, PNG, WebP). Photos are resized automatically.
        {productId === null && ' Images are uploaded when you save the product.'}
      </p>
    </div>
  )
}
