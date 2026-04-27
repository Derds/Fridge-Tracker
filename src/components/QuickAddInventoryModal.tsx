import { useState } from 'react'
import type { Ingredient, InventoryItem } from '../types'
import { calcExpiryDate } from '../store/inventoryStore'

interface Props {
  ingredient: Ingredient
  onAdd: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<void>
  onClose: () => void
}

export function QuickAddInventoryModal({ ingredient, onAdd, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [servings, setServings] = useState(1)
  const [saving, setSaving] = useState(false)

  const estimatedExpiry = calcExpiryDate(new Date(purchaseDate), ingredient.shelfLifeTier)
  const expiryStr = estimatedExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  async function handleAdd() {
    setSaving(true)
    const purchaseDateObj = new Date(purchaseDate)
    const expiryDate = calcExpiryDate(purchaseDateObj, ingredient.shelfLifeTier)
    await onAdd({
      ingredientId: ingredient.id!,
      purchaseDate: purchaseDateObj,
      expiryDate,
      servings,
      servingsRemaining: servings,
    })
    setSaving(false)
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm p-0 overflow-hidden">
        <div className="bg-secondary/10 px-5 py-4">
          <h3 className="font-bold text-lg text-secondary">Add to inventory</h3>
          <p className="text-sm text-base-content/60 mt-0.5">{ingredient.name}</p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="form-control">
            <label className="label pb-1"><span className="label-text font-medium">Purchase date</span></label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={purchaseDate}
              max={today}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>

          <div className="form-control">
            <label className="label pb-1"><span className="label-text font-medium">Servings</span></label>
            <input
              type="number"
              className="input input-bordered w-full"
              min={1}
              value={servings}
              onChange={e => setServings(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="bg-base-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-base-content/50 text-xs uppercase font-semibold tracking-wide">Estimated expiry</span>
            <p className="font-medium mt-0.5">{expiryStr}</p>
            {ingredient.storageNotes && (
              <p className="text-xs text-base-content/40 mt-1 leading-snug">{ingredient.storageNotes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 pb-4 pt-2 border-t border-base-200">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAdd}
            disabled={saving}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : 'Add to inventory'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
