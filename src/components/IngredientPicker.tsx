import { useState, useMemo } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import type { Ingredient, IngredientCategory } from '../types'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'
import { CATEGORY_ICONS } from './CatalogFilters'

interface Props {
  ingredients: Ingredient[]
  excludeIds?: Set<number>
  onConfirm: (selected: Ingredient[]) => void
  confirmLabel?: (count: number) => string
}

/**
 * Reusable multi-select ingredient picker with search and category grouping.
 * Used by AddToInventoryModal and the shopping list Add Manual modal.
 */
export function IngredientPicker({ ingredients, excludeIds, onConfirm, confirmLabel }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const available = useMemo(
    () => ingredients.filter(i => !excludeIds?.has(i.id!)),
    [ingredients, excludeIds]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return available.filter(i => !q || i.name.toLowerCase().includes(q))
  }, [available, search])

  const grouped = useMemo(
    () => CATEGORY_ORDER
      .map(cat => ({ cat: cat as IngredientCategory, items: filtered.filter(i => i.category === cat) }))
      .filter(g => g.items.length > 0),
    [filtered]
  )

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedIngredients = available.filter(i => selected.has(i.id!))
  const btnLabel = confirmLabel
    ? confirmLabel(selected.size)
    : `Add ${selected.size} item${selected.size !== 1 ? 's' : ''}`

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      <label className="input input-bordered input-md flex items-center gap-2">
        <MagnifyingGlass size={16} className="opacity-50 flex-shrink-0" />
        <input
          className="grow"
          placeholder="Search ingredients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </label>

      <div className="overflow-y-auto flex-1 min-h-[220px]">
        {grouped.length === 0 && (
          <p className="text-sm text-base-content/40 text-center py-8">No ingredients found</p>
        )}
        {grouped.map(({ cat, items }) => {
          const Icon = CATEGORY_ICONS[cat]
          return (
            <div key={cat} className="mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1 px-1">
                <Icon size={12} />
                <span>{CATEGORY_LABELS[cat]}</span>
              </div>
              {items.map(i => (
                <label key={i.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-base-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={selected.has(i.id!)}
                    onChange={() => toggle(i.id!)}
                  />
                  <span className="text-sm flex-1">{i.name}</span>
                  {i.storageNotes && (
                    <span className="text-xs text-base-content/35 hidden sm:block truncate max-w-[140px]">{i.storageNotes}</span>
                  )}
                </label>
              ))}
            </div>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="pt-3 border-t border-base-200 shrink-0">
          <button
            className="btn btn-primary w-full gap-2"
            onClick={() => onConfirm(selectedIngredients)}
          >
            {btnLabel}
          </button>
        </div>
      )}
    </div>
  )
}
