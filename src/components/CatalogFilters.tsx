import type { IngredientCategory, ShelfLifeTier } from '../types'
import { CATEGORY_LABELS, SHELF_LIFE_LABELS } from '../store/ingredientStore'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: Props) {
  return (
    <label className={`input input-bordered flex items-center gap-2 ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-70">
        <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
      </svg>
      <input
        type="text"
        className="grow"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="opacity-50 hover:opacity-100">✕</button>
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
