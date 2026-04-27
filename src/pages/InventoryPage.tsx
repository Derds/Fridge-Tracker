import { useEffect, useMemo, useState } from 'react'
import {
  useInventoryStore,
  daysUntilExpiry,
  expiryLabel,
  expiryBadgeClass,
} from '../store/inventoryStore'
import { AddToInventoryModal } from '../components/AddToInventoryModal'
import { CATEGORY_LABELS } from '../store/ingredientStore'
import { Warning, Basket, Trash, Clock, SortAscending, Tag, Plus } from '@phosphor-icons/react'

type SortMode = 'expiry' | 'category' | 'name'

export function InventoryPage() {
  const { items, loading, loadInventory, addItem, depleteItem, removeItem, clearExpired } = useInventoryStore()
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Fridge</h1>
          <p className="text-base-content/60 text-sm mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={() => setAddOpen(true)}>
          <Plus size={15} weight="bold" /> Add item
        </button>
      </div>

      {/* Expiry warning banner */}
      {expiredItems.length > 0 && (
        <div className="alert alert-error mb-4">
          <Warning size={18} /> {expiredItems.length} item{expiredItems.length !== 1 ? 's have' : ' has'} expired
          <button className="btn btn-sm btn-outline btn-error ml-auto" onClick={() => setConfirmClearExpired(true)}>
            Clear expired
          </button>
        </div>
      )}

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
          <p className="font-medium">Your fridge is empty</p>
          <p className="text-sm mt-1">Tap <strong>+ Add item</strong> to get started</p>
        </div>
      )}

      {/* Expired items (collapsed by default) */}
      {expiredItems.length > 0 && (
        <div className="mb-4">
          <details>
            <summary className="text-sm font-semibold text-error cursor-pointer mb-2">
              Expired ({expiredItems.length})
            </summary>
            <div className="flex flex-col gap-1 mt-2">
              {expiredItems.map(item => (
                <InventoryCard key={item.id} item={item} onDeplete={depleteItem} onRemove={removeItem} />
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Active items */}
      <div className="flex flex-col gap-2">
        {sorted.map(item => (
          <InventoryCard key={item.id} item={item} onDeplete={depleteItem} onRemove={removeItem} />
        ))}
      </div>

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
  onRemove: (id: number) => Promise<void>
}

function InventoryCard({ item, onDeplete, onRemove }: CardProps) {
  const days = daysUntilExpiry(item.expiryDate)
  const label = expiryLabel(days)
  const badgeClass = expiryBadgeClass(days)
  const categoryLabel = CATEGORY_LABELS[item.ingredientCategory as keyof typeof CATEGORY_LABELS] ?? item.ingredientCategory

  return (
    <div className={`card card-compact bg-base-200 ${days < 0 ? 'opacity-60' : ''}`}>
      <div className="card-body flex-row items-center gap-3 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.ingredientName}</p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span className={`badge badge-sm ${badgeClass}`}>{label}</span>
            <span className="text-xs text-base-content/40">{categoryLabel}</span>
          </div>
        </div>

        {/* Serving counter */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm text-base-content/60">
            {item.servingsRemaining}/{item.servings}
          </span>
          <button
            className="btn btn-outline btn-xs btn-square"
            onClick={() => item.id != null && onDeplete(item.id)}
            aria-label="Use one serving"
            title="Use one serving"
          >
            −
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
