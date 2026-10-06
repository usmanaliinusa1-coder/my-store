import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { CheckboxField, TextAreaField } from '@/components/ui/FormControls'
import { Modal } from '@/components/ui/Modal'
import { deleteStoredImages, pathFromPublicUrl, uploadImage, validateImageFile } from '@/lib/storage'
import { createCategory, mapCatalogError, updateCategory } from '@/services/adminCatalog'
import { toast } from '@/store/toastStore'
import { categorySchema, toCategoryPayload, type CategoryFormValues } from '@/utils/catalogSchemas'
import { slugify } from '@/utils/slug'
import type { Category } from '@/types/catalog'

interface Props {
  open: boolean
  category: Category | null
  onClose: () => void
  onSaved: () => void
}

function CategoryForm({ category, onClose, onSaved }: Omit<Props, 'open'>) {
  const slugTouched = useRef(Boolean(category))
  const fileRef = useRef<HTMLInputElement>(null)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removeExisting, setRemoveExisting] = useState(false)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      sortOrder: String(category?.sort_order ?? 0),
      isActive: category?.is_active ?? true,
    },
  })

  const shownImage = preview ?? (removeExisting ? null : (category?.image_url ?? null))

  const pickFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const problem = validateImageFile(file)
    if (problem) {
      toast.error(problem)
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setNewFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview)
    setNewFile(null)
    setPreview(null)
    if (category?.image_url) setRemoveExisting(true)
  }

  const onSubmit = async (values: CategoryFormValues) => {
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      let imageUrl: string | null = removeExisting ? null : (category?.image_url ?? null)
      if (newFile) {
        const uploaded = await uploadImage(newFile, 'categories')
        uploadedPath = uploaded.path
        imageUrl = uploaded.url
      }
      const payload = { ...toCategoryPayload(values), image_url: imageUrl }

      if (category) await updateCategory(category.id, payload)
      else await createCategory(payload)

      // old picture is no longer referenced
      if (category?.image_url && category.image_url !== imageUrl) {
        await deleteStoredImages([pathFromPublicUrl(category.image_url)])
      }
      toast.success(category ? 'Category updated' : 'Category created')
      onSaved()
    } catch (err) {
      if (uploadedPath) await deleteStoredImages([uploadedPath])
      toast.error(mapCatalogError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField
        label="Name"
        error={errors.name?.message}
        {...register('name', {
          onChange: (e) => {
            if (!slugTouched.current) setValue('slug', slugify(e.target.value), { shouldValidate: true })
          },
        })}
      />
      <TextField
        label="Slug (used in the web address)"
        hint="Lowercase letters, numbers and hyphens."
        error={errors.slug?.message}
        {...register('slug', { onChange: () => (slugTouched.current = true) })}
      />
      <TextAreaField label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <TextField label="Display order" inputMode="numeric" hint="Lower numbers appear first." error={errors.sortOrder?.message} {...register('sortOrder')} />

      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700">Category image (optional)</p>
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-gray-300">
            {shownImage ? <img src={shownImage} alt="Category preview" width={80} height={80} className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" aria-hidden="true" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              {shownImage ? 'Replace' : 'Upload image'}
            </Button>
            {shownImage && (
              <Button type="button" size="sm" variant="ghost" onClick={clearImage} leftIcon={<Trash2 className="h-4 w-4" />}>
                Remove
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label="Choose category image" onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      </div>

      <CheckboxField label="Active" description="Inactive categories are hidden from customers." {...register('isActive')} />

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  )
}

export function CategoryFormModal({ open, category, onClose, onSaved }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <CategoryForm key={category?.id ?? 'new'} category={category} onClose={onClose} onSaved={onSaved} />
    </Modal>
  )
}
