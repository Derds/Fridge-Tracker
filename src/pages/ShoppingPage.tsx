import { useEffect, useMemo, useState } from 'react'
import { useShoppingStore } from '../store/shoppingStore'
import { useIngredientStore, CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'
import { useInventoryStore, calcExpiryDate } from '../store/inventoryStore'
import { CATEGORY_ICONS } from '../components/CatalogFilters'
import { IngredientPicker } from '../components/IngredientPicker'
import type { Ingredient, IngredientCategory, ShoppingListItem } from '../types'
import { ShoppingCart, Plus, X, Trash, CheckCircle } from '@phosphor-icons/react'

export function ShoppingPage() {
  const { list, loading, loadOrCreateList, moveToActual, removeFromActual,
    removeFromPotential, toggleChecked, clearChecked, addManual, bulkRemoveFromActual } = useShoppingStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory, addItem: addInventoryItem } = useInventoryStore()
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<'list' | 'suggestions'>('list')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [suggSearch, setSuggSearch] = useState('')
  const [suggCategory, setSuggCategory] = useState<IngredientCategory | 'all'>('all')

  useEffect(() => {
    loadOrCreateList()
    loadIngredients()
    loadInventory()
  }, [loadOrCreateList, loadIngredients, loadInventory])

  const ingredientMap = useMemo(() =>
    new Map(ingredients.map(i => [i.id!, i])), [ingredients])

  // Suggestions: only items previously tracked in inventory that have run out
  const depleted = useMemo(() => {
    if (!list) return []
    const alreadyListed = new Set([
      ...list.potentialItems.map(i => i.ingredientId),
      ...list.actualItems.map(i => i.ingredientId),
    ])
    return inventory
      .filter(i => i.servingsRemaining === 0 && !alreadyListed.has(i.ingredientId))
      .map(i => ingredientMap.get(i.ingredientId))
      .filter(Boolean) as Ingredient[]
  }, [inventory, list, ingredientMap])

  // Combine potential + depleted into one grouped suggestions list
  const suggestionsGrouped = useMemo(() => {
    type SuggestionEntry = { ingredient: Ingredient; reason: string; fromPotential: boolean }
    const entries: SuggestionEntry[] = [
      ...(list?.potentialItems.map(item => ({
        ingredient: ingredientMap.get(item.ingredientId),
        reason: item.reason ?? 'manual',
        fromPotential: true,
      })).filter(e => e.ingredient) as SuggestionEntry[]),
      ...depleted.map(ingredient => ({ ingredient, reason: 'depleted', fromPotential: false })),
    ]
    return CATEGORY_ORDER.map(cat => ({
      cat: cat as IngredientCategory,
      items: entries.filter(e => e.ingredient.category === cat),
    })).filter(g => g.items.length > 0)
  }, [list, depleted, ingredientMap])

  // Previously stocked (have inventory records) but not depleted/potential
  const previouslyStocked = useMemo(() => {
    if (!list) return [] as Ingredient[]
    const alreadySuggested = new Set([
      ...list.potentialItems.map(i => i.ingredientId),
      ...list.actualItems.map(i => i.ingredientId),
      ...depleted.map(i => i.id!),
    ])
    const inventoryIngIds = new Set(inventory.map(i => i.ingredientId))
    return ingredients.filter(i => i.id != null && inventoryIngIds.has(i.id!) && !alreadySuggested.has(i.id!))
  }, [inventory, ingredients, list, depleted])

  // All catalog items not in list and not already suggested
  const allUnlisted = useMemo(() => {
    if (!list) return [] as Ingredient[]
    const alreadySuggested = new Set([
      ...list.potentialItems.map(i => i.ingredientId),
      ...list.actualItems.map(i => i.ingredientId),
      ...depleted.map(i => i.id!),
      ...previouslyStocked.map(i => i.id!),
    ])
    return ingredients.filter(i => i.id != null && !alreadySuggested.has(i.id!))
  }, [ingredients, list, depleted, previouslyStocked])

  function matchesSuggFilter(ing: Ingredient) {
    if (suggCategory !== 'all' && ing.category !== suggCategory) return false
    if (suggSearch && !ing.name.toLowerCase().includes(suggSearch.toLowerCase())) return false
    return true
  }

  const suggestionsCount = (list?.potentialItems.length ?? 0) + depleted.length
  const grouped = useMemo(() => {
    if (!list) return new Map<string, ShoppingListItem[]>()
    const map = new Map<string, ShoppingListItem[]>()
    CATEGORY_ORDER.forEach(cat => {
      const catItems = list.actualItems.filter(i => ingredientMap.get(i.ingredientId)?.category === cat)
      if (catItems.length) map.set(cat, catItems)
    })
    return map
  }, [list, ingredientMap])

  const checkedCount = list?.actualItems.filter(i => i.checked).length ?? 0
  const totalCount = list?.actualItems.length ?? 0

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleToggleChecked(item: ShoppingListItem) {
    const isChecking = !item.checked
    await toggleChecked(item.ingredientId)
    if (isChecking) {
      const ingredient = ingredientMap.get(item.ingredientId)
      if (ingredient) {
        const now = new Date()
        await addInventoryItem({
          ingredientId: item.ingredientId,
          purchaseDate: now,
          expiryDate: calcExpiryDate(now, ingredient.shelfLifeTier),
          servings: 1,
          servingsRemaining: 1,
        })
      }
    }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          {totalCount > 0 && (
            <p className="text-base-content/60 text-sm mt-1">
              {checkedCount}/{totalCount} ticked off
              {checkedCount === 0 && <span className="ml-1 opacity-60">· tick to add to inventory</span>}
            </p>
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
        <button role="tab" className={`tab ${tab === 'suggestions' ? 'tab-active' : ''}`} onClick={() => setTab('suggestions')}>
          Suggestions {suggestionsCount > 0 && <span className="badge badge-sm ml-1">{suggestionsCount}</span>}
        </button>
      </div>

      {/* ── My List ── */}
      {tab === 'list' && (
        <>
          {totalCount === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <ShoppingCart size={48} weight="thin" className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Your list is empty</p>
              <p className="text-sm mt-1">Add items manually or pick from the Suggestions tab</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-3">
                {selectMode ? (
                  <>
                    <span className="text-sm text-base-content/60 self-center">{selected.size} selected</span>
                    <button
                      className="btn btn-error btn-xs gap-1"
                      disabled={selected.size === 0}
                      onClick={async () => {
                        await bulkRemoveFromActual([...selected])
                        exitSelectMode()
                      }}
                    >
                      <Trash size={13} /> Remove selected
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={exitSelectMode}>Cancel</button>
                  </>
                ) : (
                  <>
                    {checkedCount > 0 && (
                      <button className="btn btn-ghost btn-xs text-base-content/50" onClick={clearChecked}>
                        Clear ticked ({checkedCount})
                      </button>
                    )}
                    <button className="btn btn-ghost btn-xs" onClick={() => setSelectMode(true)}>
                      Select to remove
                    </button>
                  </>
                )}
              </div>
              {[...grouped.entries()].map(([cat, items]) => {
                const Icon = CATEGORY_ICONS[cat as IngredientCategory]
                return (
                  <div key={cat} className="mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      {Icon && <Icon size={13} />}
                      <span>{CATEGORY_LABELS[cat as IngredientCategory]}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map(item => {
                        const ingredient = ingredientMap.get(item.ingredientId)
                        const isSelected = selected.has(item.ingredientId)
                        return (
                          <label
                            key={item.ingredientId}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-base-200 cursor-pointer ${item.checked && !selectMode ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-error/40' : ''}`}
                            title={!selectMode && !item.checked ? 'Tick to mark as bought and add to inventory' : undefined}
                          >
                            <input
                              type="checkbox"
                              className={`checkbox checkbox-sm ${selectMode ? 'checkbox-error' : 'checkbox-primary'}`}
                              checked={selectMode ? isSelected : item.checked}
                              onChange={() => selectMode ? toggleSelect(item.ingredientId) : handleToggleChecked(item)}
                            />
                            <span className={`flex-1 ${item.checked && !selectMode ? 'line-through' : ''}`}>
                              {ingredient?.name ?? '—'}
                            </span>
                            {item.checked && !selectMode && (
                              <span className="text-success flex items-center gap-1 text-xs">
                                <CheckCircle size={13} weight="fill" /> in inventory
                              </span>
                            )}
                            {!selectMode && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                                onClick={e => { e.preventDefault(); removeFromActual(item.ingredientId) }}
                                aria-label="Remove"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {/* ── Suggestions ── */}
      {tab === 'suggestions' && (
        <div>
          {/* Search + category filter */}
          <div className="flex gap-2 mb-3">
            <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
              <input
                className="grow"
                placeholder="Search ingredients…"
                value={suggSearch}
                onChange={e => setSuggSearch(e.target.value)}
              />
            </label>
            <select
              className="select select-bordered select-sm"
              value={suggCategory}
              onChange={e => setSuggCategory(e.target.value as IngredientCategory | 'all')}
            >
              <option value="all">All categories</option>
              {CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>

          {/* Meal plan + depleted suggestions */}
          {suggestionsGrouped.filter(g => g.items.some(e => matchesSuggFilter(e.ingredient))).length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-2">Suggested for you</p>
              {suggestionsGrouped.map(({ cat, items }) => {
                const filtered = items.filter(e => matchesSuggFilter(e.ingredient))
                if (!filtered.length) return null
                const Icon = CATEGORY_ICONS[cat]
                return (
                  <div key={cat} className="mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      {Icon && <Icon size={13} />}
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {filtered.map(({ ingredient, reason, fromPotential }) => (
                        <SuggestionRow
                          key={ingredient.id}
                          ingredient={ingredient}
                          reason={reason}
                          onAdd={() => moveToActual(ingredient.id!)}
                          onDismiss={fromPotential ? () => removeFromPotential(ingredient.id!) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Previously stocked */}
          {previouslyStocked.filter(matchesSuggFilter).length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-2">Previously stocked</p>
              {CATEGORY_ORDER.map(cat => {
                const items = previouslyStocked.filter(i => i.category === cat && matchesSuggFilter(i))
                if (!items.length) return null
                const Icon = CATEGORY_ICONS[cat]
                return (
                  <div key={cat} className="mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      {Icon && <Icon size={13} />}
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map(ingredient => (
                        <SuggestionRow key={ingredient.id} ingredient={ingredient} reason="previously stocked" onAdd={() => moveToActual(ingredient.id!)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Browse all catalog */}
          {allUnlisted.filter(matchesSuggFilter).length > 0 && (
            <details className="mb-5">
              <summary className="text-xs font-semibold text-base-content/40 uppercase tracking-wide cursor-pointer mb-2 list-none flex items-center gap-1">
                <span>Browse all ingredients</span>
                <span className="badge badge-ghost badge-xs">{allUnlisted.filter(matchesSuggFilter).length}</span>
              </summary>
              {CATEGORY_ORDER.map(cat => {
                const items = allUnlisted.filter(i => i.category === cat && matchesSuggFilter(i))
                if (!items.length) return null
                const Icon = CATEGORY_ICONS[cat]
                return (
                  <div key={cat} className="mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      {Icon && <Icon size={13} />}
                      <span>{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map(ingredient => (
                        <SuggestionRow key={ingredient.id} ingredient={ingredient} onAdd={() => moveToActual(ingredient.id!)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </details>
          )}

          {suggestionsGrouped.length === 0 && previouslyStocked.length === 0 && allUnlisted.length === 0 && (
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
          onAdd={async (ids) => { for (const id of ids) await addManual(id); setAddOpen(false) }}
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
  onDismiss?: () => void
}) {
  const reasonLabel: Record<string, string> = {
    depleted: 'ran out',
    manual: 'added manually',
    'meal-plan': 'from meal plan',
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-base-200">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{ingredient?.name ?? '—'}</p>
        {reason && <p className="text-xs text-base-content/40">{reasonLabel[reason] ?? reason}</p>}
      </div>
      {onDismiss && (
        <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
      <button className="btn btn-primary btn-xs" onClick={onAdd}>Add to list</button>
    </div>
  )
}

function AddManualModal({ ingredients, existingIds, onAdd, onClose }: {
  ingredients: Ingredient[]
  existingIds: Set<number>
  onAdd: (ids: number[]) => Promise<void>
  onClose: () => void
}) {
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-md flex flex-col max-h-[85vh] p-0 overflow-hidden">
        <div className="bg-secondary/10 px-6 py-4 shrink-0">
          <h3 className="font-bold text-lg text-secondary">Add to shopping list</h3>
          <p className="text-sm text-base-content/60 mt-0.5">Select items to add directly to My List</p>
        </div>
        <div className="flex flex-col flex-1 min-h-0 px-6 py-4">
          <IngredientPicker
            ingredients={ingredients}
            excludeIds={existingIds}
            onConfirm={(selected) => onAdd(selected.map(i => i.id!))}
            confirmLabel={n => `Add ${n} to list`}
          />
        </div>
        <div className="modal-action px-6 pb-4 mt-0 shrink-0 border-t border-base-200 pt-3">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
