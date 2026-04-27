import type { IngredientCategory, ShelfLifeTier } from '../types'
import { CATEGORY_LABELS, SHELF_LIFE_LABELS } from '../store/ingredientStore'
import { MagnifyingGlass, X } from '@phosphor-icons/react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: Props) {
  return (
    <label className={`input input-bordered flex items-center gap-2 ${className}`}>
      <MagnifyingGlass size={16} className="opacity-70 flex-shrink-0" />
      <input
        type="text"
        className="grow"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="opacity-50 hover:opacity-100"><X size={14} /></button>
      )}
    </label>
  )
}

interface CategoryFilterProps {
  value: IngredientCategory | 'all'
  onChange: (value: IngredientCategory | 'all') => void
}

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const options: Array<{ value: IngredientCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k as IngredientCategory, label: v })),
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`btn btn-sm ${value === opt.value ? 'btn-primary' : 'btn-ghost'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface ShelfLifeBadgeProps {
  tier: ShelfLifeTier
}

const SHELF_LIFE_BADGE_COLOURS: Record<ShelfLifeTier, string> = {
  'very-perishable': 'badge-error',
  'perishable': 'badge-warning',
  'stable': 'badge-info',
  'shelf-stable': 'badge-success',
}

export function ShelfLifeBadge({ tier }: ShelfLifeBadgeProps) {
  return (
    <span className={`badge badge-sm ${SHELF_LIFE_BADGE_COLOURS[tier]}`}>
      {SHELF_LIFE_LABELS[tier]}
    </span>
  )
}
