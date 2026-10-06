import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const base =
  'block w-full rounded-lg border bg-white px-3.5 py-3 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100'

function FieldShell({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface CommonProps {
  label: string
  error?: string
  hint?: string
}

export const SelectField = forwardRef<HTMLSelectElement, CommonProps & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, className, id, children, ...props }, ref) {
    const autoId = useId()
    const fieldId = id ?? autoId
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(base, error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400', className)}
          {...props}
        >
          {children}
        </select>
      </FieldShell>
    )
  },
)

export const TextAreaField = forwardRef<HTMLTextAreaElement, CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextAreaField({ label, error, hint, className, id, ...props }, ref) {
    const autoId = useId()
    const fieldId = id ?? autoId
    return (
      <FieldShell id={fieldId} label={label} error={error} hint={hint}>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(base, 'min-h-[7rem] resize-y', error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400', className)}
          {...props}
        />
      </FieldShell>
    )
  },
)

export const CheckboxField = forwardRef<HTMLInputElement, { label: string; description?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function CheckboxField({ label, description, id, className, ...props }, ref) {
    const autoId = useId()
    const fieldId = id ?? autoId
    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className={cn('mt-1 h-5 w-5 rounded border-gray-300 text-brand-600', className)}
          {...props}
        />
        <label htmlFor={fieldId} className="text-sm">
          <span className="font-medium text-gray-800">{label}</span>
          {description && <span className="block text-gray-500">{description}</span>}
        </label>
      </div>
    )
  },
)
