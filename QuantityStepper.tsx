import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
  label?: string
}

export function QuantityStepper({ value, min = 1, max, disabled, onChange, label = 'Quantity' }: QuantityStepperProps) {
  const btn =
    'flex h-10 w-10 items-center justify-center text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white">
      <button type="button" className={btn} aria-label="Decrease quantity" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[2.5rem] select-none text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} aria-label="Increase quantity" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
