import { useEffect, useMemo, useState } from 'react'
import {
  useInventoryStore,
  daysUntilExpiry,
  expiryLabel,
  expiryBadgeClass,
} from '../store/inventoryStore'
import { AddToInventoryModal } from '../components/AddToInventoryModal'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'
import { CATEGORY_ICONS } from '../components/CatalogFilters'
import { Warning, Basket, Trash, Clock, SortAscending, Tag, Plus } from '@phosphor-icons/react'
import type { IngredientCategory } from '../types'

type SortMode = 'expiry' | 'category' | 'name'

export function InventoryPage() {
  const { items, loading, loadInventory, addItem, depleteItem, incrementItem, removeItem, clearExpired } = useInventoryStore()
  const [addOpen, setAddOpen] = useState(false)
  const [sort, setSort] = useState<SortMode>('expiry')
  const [confirmClearExpired, setConfirmClearExpired] = useState(false)

  useEffect(() => { loadInventory() }, [loadInventory])

  const expiredItems = useMemo(() => items.filter(i => daysUntilExpiry(i.expiryDate) < 0), [items])
  const activeItems = useMemo(() => items.filter(i => daysUntilExpiry(i.expiryDate) >= 0), [items])

  const sorted = useMemo(() => {
    const list = [...activeItems]
    if (sort === 'expiry') return list.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
    if (sort === 'name') return list.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName))
    if (sort === 'category') return list.sort((a, b) => a.ingredientCategory.localeCompare(b.ingredientCategory) || a.ingredientName.localeCompare(b.ingredientName))
    return list
  }, [activeItems, sort])

  // Grouped view — only used when sort === 'category'
  const groupedByCategory = useMemo(() => {
    if (sort !== 'category') return null
    return CATEGORY_ORDER
      .map(cat => ({
        cat,
        items: activeItems
          .filter(i => i.ingredientCategory === cat)
          .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
      }))
      .filter(g => g.items.length > 0)
  }, [activeItems, sort])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Inventory</h1>
          <p className="text-base-content/60 text-sm mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setAddOpen(true)}>
          <Plus size={15} weight="bold" /> Add item
        </button>
      </div>

      {/* Sort controls */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="text-sm text-base-content/50 self-center">Sort:</span>
          {(['expiry', 'name', 'category'] as SortMode[]).map(s => (
            <button key={s} className={`btn btn-xs ${sort === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSort(s)}>
              {s === 'expiry' ? <><Clock size={13} /> Expiry</> : s === 'name' ? <><SortAscending size={13} /> Name</> : <><Tag size={13} /> Category</>}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-base-content/50">
          <Basket size={48} weight="thin" className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Your inventory is empty</p>
          <p className="text-sm mt-1">Tap <strong>+ Add item</strong> to get started</p>
        </div>
      )}

      {/* Active items */}
      {groupedByCategory ? (
        <div className="flex flex-col gap-6">
          {groupedByCategory.map(({ cat, items: catItems }) => {
            const CatIcon = CATEGORY_ICONS[cat as IngredientCategory]
            return (
              <div key={cat}>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                  <CatIcon size={13} />
                  <span>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</span>
                  <span className="font-normal normal-case tracking-normal opacity-60">· {catItems.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {catItems.map(item => (
                    <InventoryCard key={item.id} item={item} onDeplete={depleteItem} onIncrement={incrementItem} onRemove={removeItem} hideCategory />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map(item => (
            <InventoryCard key={item.id} item={item} onDeplete={depleteItem} onIncrement={incrementItem} onRemove={removeItem} />
          ))}
        </div>
      )}

      {/* Expired items — collapsed, at the bottom */}
      {expiredItems.length > 0 && (
        <div className="mt-6">
          <details>
            <summary className="flex items-center gap-2 text-sm font-medium text-warning cursor-pointer select-none">
              <Warning size={15} weight="fill" />
              {expiredItems.length} expired item{expiredItems.length !== 1 ? 's' : ''} — tap to review
            </summary>
            <div className="flex flex-col gap-1.5 mt-2">
              {expiredItems.map(item => (
                <InventoryCard key={item.id} item={item} onDeplete={depleteItem} onIncrement={incrementItem} onRemove={removeItem} />
              ))}
              <button className="btn btn-sm btn-outline btn-warning mt-1 self-start" onClick={() => setConfirmClearExpired(true)}>
                Clear all expired
              </button>
            </div>
          </details>
        </div>
      )}

      {addOpen && (
        <AddToInventoryModal onClose={() => setAddOpen(false)} onAdd={addItem} />
      )}

      {confirmClearExpired && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Clear {expiredItems.length} expired items?</h3>
            <p className="py-3 text-base-content/70">This will remove all expired items from your inventory.</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setConfirmClearExpired(false)}>Cancel</button>
              <button className="btn btn-error" onClick={async () => { await clearExpired(); setConfirmClearExpired(false) }}>
                Clear all expired
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmClearExpired(false)} />
        </dialog>
      )}
    </div>
  )
}

interface CardProps {
  item: ReturnType<typeof useInventoryStore.getState>['items'][number]
  onDeplete: (id: number) => Promise<void>
  onIncrement: (id: number) => Promise<void>
  onRemove: (id: number) => Promise<void>
  hideCategory?: boolean
}

function InventoryCard({ item, onDeplete, onIncrement, onRemove, hideCategory }: CardProps) {
  const days = daysUntilExpiry(item.expiryDate)
  const label = expiryLabel(days)
  const badgeClass = expiryBadgeClass(days)
  const categoryLabel = CATEGORY_LABELS[item.ingredientCategory as keyof typeof CATEGORY_LABELS] ?? item.ingredientCategory

  return (
    <div className={`card card-compact bg-base-200 ${days < 0 ? 'opacity-60' : ''}`}>
      <div className="card-body flex-row items-center gap-3 py-2.5 px-3">

        {/* Inline name + badges */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 min-w-0">
          <span className="font-semibold text-primary">{item.ingredientName}</span>
          <span className={`badge badge-sm ${badgeClass}`}>{label}</span>
          {!hideCategory && (
            <span className="text-xs text-base-content/40">{categoryLabel}</span>
          )}
        </div>

        {/* Serving counter */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="btn btn-outline btn-xs btn-square"
            onClick={() => item.id != null && onDeplete(item.id)}
            aria-label="Use one serving"
            title="Use one serving (−1)"
          >
            −
          </button>
          <span className="text-sm text-base-content/60 min-w-[2.5rem] text-center tabular-nums">
            {item.servingsRemaining}/{item.servings}
          </span>
          <button
            className="btn btn-outline btn-xs btn-square btn-success"
            onClick={() => item.id != null && onIncrement(item.id)}
            aria-label="Add one serving"
            title="Add one serving — e.g. leftovers (+1)"
          >
            +
          </button>
        </div>

        <button
          className="btn btn-ghost btn-xs text-error shrink-0"
          onClick={() => item.id != null && onRemove(item.id)}
          aria-label="Remove item"
        >
          <Trash size={15} />
        </button>
      </div>
    </div>
  )
}
