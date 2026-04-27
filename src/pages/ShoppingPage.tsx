import { useEffect, useMemo, useState } from 'react'
import { useShoppingStore } from '../store/shoppingStore'
import { useIngredientStore, CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'
import { useInventoryStore } from '../store/inventoryStore'
import type { Ingredient, ShoppingListItem } from '../types'
import { ShoppingCart, Plus, X, MagnifyingGlass } from '@phosphor-icons/react'

export function ShoppingPage() {
  const { list, loading, loadOrCreateList, moveToActual, removeFromActual,
    removeFromPotential, toggleChecked, clearChecked, addManual } = useShoppingStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory } = useInventoryStore()
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<'list' | 'potential'>('list')

  useEffect(() => {
    loadOrCreateList()
    loadIngredients()
    loadInventory()
  }, [loadOrCreateList, loadIngredients, loadInventory])

  // Auto-suggest depleted items (in inventory with 0 servings remaining, or not in inventory at all)
  const depleted = useMemo(() => {
    if (!list) return []
    const inStock = new Set(inventory.filter(i => i.servingsRemaining > 0).map(i => i.ingredientId))
    const alreadySuggested = new Set([
      ...list.potentialItems.map(i => i.ingredientId),
      ...list.actualItems.map(i => i.ingredientId),
    ])
    return ingredients
      .filter(i => !inStock.has(i.id!) && !alreadySuggested.has(i.id!))
  }, [ingredients, inventory, list])

  const ingredientMap = useMemo(() =>
    new Map(ingredients.map(i => [i.id!, i])), [ingredients])

  const checkedCount = list?.actualItems.filter(i => i.checked).length ?? 0
  const totalCount = list?.actualItems.length ?? 0

  // Group actual list by category
  const grouped = useMemo(() => {
    if (!list) return new Map<string, ShoppingListItem[]>()
    const map = new Map<string, ShoppingListItem[]>()
    CATEGORY_ORDER.forEach(cat => {
      const catItems = list.actualItems.filter((i: ShoppingListItem) => ingredientMap.get(i.ingredientId)?.category === cat)
      if (catItems.length) map.set(cat, catItems)
    })
    return map
  }, [list, ingredientMap])

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          {totalCount > 0 && (
            <p className="text-base-content/60 text-sm mt-1">{checkedCount}/{totalCount} ticked off</p>
          )}
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setAddOpen(true)}>
          <Plus size={15} weight="bold" /> Add item
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-bordered mb-4">
        <button role="tab" className={`tab ${tab === 'list' ? 'tab-active' : ''}`} onClick={() => setTab('list')}>
          My list {totalCount > 0 && <span className="badge badge-sm ml-1">{totalCount}</span>}
        </button>
        <button role="tab" className={`tab ${tab === 'potential' ? 'tab-active' : ''}`} onClick={() => setTab('potential')}>
          Suggestions {(list?.potentialItems.length ?? 0) + depleted.length > 0 &&
            <span className="badge badge-sm ml-1">{(list?.potentialItems.length ?? 0) + depleted.length}</span>}
        </button>
      </div>

      {tab === 'list' && (
        <>
          {totalCount === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <ShoppingCart size={48} weight="thin" className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Your list is empty</p>
              <p className="text-sm mt-1">Add items or pick from the Suggestions tab</p>
            </div>
          ) : (
            <>
              {checkedCount > 0 && (
                <div className="flex justify-end mb-2">
                  <button className="btn btn-ghost btn-xs text-base-content/50" onClick={clearChecked}>
                    Clear ticked ({checkedCount})
                  </button>
                </div>
              )}
              {[...grouped.entries()].map(([cat, items]) => (
                <div key={cat} className="mb-4">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                  </p>
                  <div className="flex flex-col gap-1">
                    {items.map(item => {
                      const ingredient = ingredientMap.get(item.ingredientId)
                      return (
                        <label key={item.ingredientId} className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-base-200 cursor-pointer ${item.checked ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={item.checked}
                            onChange={() => toggleChecked(item.ingredientId)}
                          />
                          <span className={`flex-1 ${item.checked ? 'line-through' : ''}`}>
                            {ingredient?.name ?? '—'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                            onClick={e => { e.preventDefault(); removeFromActual(item.ingredientId) }}
                            aria-label="Remove"
                          >
                            <X size={14} />
                          </button>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'potential' && (
        <div className="flex flex-col gap-1">
          {/* Manually added potential items */}
          {list?.potentialItems.map(item => {
            const ingredient = ingredientMap.get(item.ingredientId)
            return (
              <SuggestionRow
                key={item.ingredientId}
                ingredient={ingredient}
                reason={item.reason}
                onAdd={() => moveToActual(item.ingredientId)}
                onDismiss={() => removeFromPotential(item.ingredientId)}
              />
            )
          })}
          {/* Auto-depleted suggestions */}
          {depleted.map(ingredient => (
            <SuggestionRow
              key={ingredient.id}
              ingredient={ingredient}
              reason="depleted"
              onAdd={() => { moveToActual(ingredient.id!); }}
              onDismiss={() => {/* just ignore */}}
            />
          ))}
          {(list?.potentialItems.length ?? 0) === 0 && depleted.length === 0 && (
            <div className="text-center py-12 text-base-content/50">
              <p className="text-sm">No suggestions — everything seems stocked up!</p>
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <AddManualModal
          ingredients={ingredients}
          existingIds={new Set([
            ...(list?.potentialItems.map(i => i.ingredientId) ?? []),
            ...(list?.actualItems.map(i => i.ingredientId) ?? []),
          ])}
          onAdd={async (id) => { await addManual(id); setAddOpen(false) }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

function SuggestionRow({ ingredient, reason, onAdd, onDismiss }: {
  ingredient: Ingredient | undefined
  reason?: string
  onAdd: () => void
  onDismiss: () => void
}) {
  const reasonLabel: Record<string, string> = {
    depleted: 'ran out',
    manual: 'added',
    'meal-plan': 'meal plan',
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-base-200">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{ingredient?.name ?? '—'}</p>
        {reason && <p className="text-xs text-base-content/40">{reasonLabel[reason] ?? reason}</p>}
      </div>
      <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={onDismiss} aria-label="Dismiss"><X size={14} /></button>
      <button className="btn btn-primary btn-xs" onClick={onAdd}>Add to list</button>
    </div>
  )
}

function AddManualModal({ ingredients, existingIds, onAdd, onClose }: {
  ingredients: Ingredient[]
  existingIds: Set<number>
  onAdd: (id: number) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ingredients.filter(i => !existingIds.has(i.id!) && (!q || i.name.toLowerCase().includes(q)))
  }, [ingredients, existingIds, search])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    CATEGORY_ORDER.forEach(c => {
      const items = filtered.filter(i => i.category === c)
      if (items.length) map.set(c, items)
    })
    return map
  }, [filtered])

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-md flex flex-col max-h-[85vh]">
        <h3 className="font-bold text-lg mb-3">Add to list</h3>
        <label className="input input-bordered flex items-center gap-2 mb-3">
          <MagnifyingGlass size={16} className="opacity-50 flex-shrink-0" />
          <input className="grow" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </label>
        <div className="overflow-y-auto flex-1">
          {[...grouped.entries()].map(([cat, items]) => (
            <div key={cat} className="mb-3">
              <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1 px-1">
                {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
              </p>
              {items.map(i => (
                <button key={i.id} type="button" onClick={() => onAdd(i.id!)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm">
                  {i.name}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-action mt-3 shrink-0">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
