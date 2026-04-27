import { useState, useEffect, useMemo } from 'react'
import { useIngredientStore, CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'
import { calcExpiryDate } from '../store/inventoryStore'
import type { InventoryItem } from '../types'
import { MagnifyingGlass, ArrowLeft } from '@phosphor-icons/react'

interface Props {
  onClose: () => void
  onAdd: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<void>
}

export function AddToInventoryModal({ onClose, onAdd }: Props) {
  const { ingredients, loadIngredients } = useIngredientStore()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [servings, setServings] = useState(1)
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [useCustomExpiry, setUseCustomExpiry] = useState(false)
  const [customExpiry, setCustomExpiry] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadIngredients() }, [loadIngredients])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ingredients.filter(i => !q || i.name.toLowerCase().includes(q))
  }, [ingredients, search])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    CATEGORY_ORDER.forEach(c => {
      const items = filtered.filter(i => i.category === c)
      if (items.length) map.set(c, items)
    })
    return map
  }, [filtered])

  const selected = ingredients.find(i => i.id === selectedId)

  const previewExpiry = useMemo(() => {
    if (!selected) return null
    if (useCustomExpiry && customExpiry) return new Date(customExpiry)
    return calcExpiryDate(new Date(purchaseDate), selected.shelfLifeTier)
  }, [selected, purchaseDate, useCustomExpiry, customExpiry])

  const handleAdd = async () => {
    if (!selectedId || !selected) return
    setSaving(true)
    const pd = new Date(purchaseDate)
    const expiry = useCustomExpiry && customExpiry
      ? new Date(customExpiry)
      : calcExpiryDate(pd, selected.shelfLifeTier)
    await onAdd({
      ingredientId: selectedId,
      purchaseDate: pd,
      expiryDate: expiry,
      servings,
      servingsRemaining: servings,
    })
    setSaving(false)
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-lg flex flex-col max-h-[90vh]">
        <h3 className="font-bold text-lg mb-3">Add to Fridge</h3>

        {/* Ingredient picker */}
        {!selected ? (
          <>
            <label className="input input-bordered flex items-center gap-2 mb-3">
              <MagnifyingGlass size={16} className="opacity-70 flex-shrink-0" />
              <input
                className="grow"
                placeholder="Search ingredients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </label>
            <div className="overflow-y-auto flex-1">
              {[...grouped.entries()].map(([cat, items]) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1 px-1">
                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                  </p>
                  {items.map(i => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setSelectedId(i.id!)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm"
                    >
                      {i.name}
                      <span className="text-base-content/40 text-xs ml-2">{i.storageNotes}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Detail form once ingredient selected */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectedId(null)} className="btn btn-ghost btn-xs gap-1"><ArrowLeft size={14} /> Back</button>
              <span className="font-semibold">{selected.name}</span>
            </div>

            {selected.storageNotes && (
              <p className="text-sm text-base-content/60 bg-base-200 rounded-lg px-3 py-2">{selected.storageNotes}</p>
            )}

            <label className="form-control">
              <div className="label"><span className="label-text">Servings / portions</span></div>
              <div className="flex items-center gap-3">
                <button type="button" className="btn btn-outline btn-sm btn-square" onClick={() => setServings(s => Math.max(1, s - 1))}>−</button>
                <span className="text-xl font-bold w-8 text-center">{servings}</span>
                <button type="button" className="btn btn-outline btn-sm btn-square" onClick={() => setServings(s => s + 1)}>+</button>
              </div>
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Purchase date</span></div>
              <input
                type="date"
                className="input input-bordered"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </label>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={useCustomExpiry}
                  onChange={e => setUseCustomExpiry(e.target.checked)}
                />
                <span className="label-text">Set custom use-by date</span>
              </label>
              {useCustomExpiry && (
                <input
                  type="date"
                  className="input input-bordered mt-2"
                  value={customExpiry}
                  onChange={e => setCustomExpiry(e.target.value)}
                  min={purchaseDate}
                />
              )}
            </div>

            {previewExpiry && (
              <p className="text-sm text-base-content/60">
                Use by: <span className="font-medium text-base-content">{previewExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            )}
          </div>
        )}

        <div className="modal-action mt-4 shrink-0">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {selected && (
            <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : 'Add to fridge'}
            </button>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
