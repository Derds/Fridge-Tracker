import { useState, useMemo, useEffect } from 'react'
import { useIngredientStore } from '../store/ingredientStore'
import { calcExpiryDate } from '../store/inventoryStore'
import { IngredientPicker } from './IngredientPicker'
import type { Ingredient, InventoryItem } from '../types'
import { ArrowLeft } from '@phosphor-icons/react'

interface Props {
  onClose: () => void
  onAdd: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<void>
}

type Step = 'pick' | 'configure'

interface BatchEntry {
  ingredient: Ingredient
  servings: number
}

export function AddToInventoryModal({ onClose, onAdd }: Props) {
  const { ingredients, loadIngredients } = useIngredientStore()
  const [step, setStep] = useState<Step>('pick')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadIngredients() }, [loadIngredients])

  const existingIds = useMemo(() => new Set<number>(), [])

  function handlePickConfirm(selected: Ingredient[]) {
    setBatch(selected.map(i => ({ ingredient: i, servings: 1 })))
    setStep('configure')
  }

  function setServings(id: number, val: number) {
    setBatch(b => b.map(e => e.ingredient.id === id ? { ...e, servings: Math.max(1, val) } : e))
  }

  async function handleAddAll() {
    setSaving(true)
    const pd = new Date(purchaseDate)
    for (const { ingredient, servings } of batch) {
      const expiry = calcExpiryDate(pd, ingredient.shelfLifeTier)
      await onAdd({
        ingredientId: ingredient.id!,
        purchaseDate: pd,
        expiryDate: expiry,
        servings,
        servingsRemaining: servings,
      })
    }
    setSaving(false)
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-lg flex flex-col max-h-[90vh] p-0 overflow-hidden">
        {/* Coloured header band */}
        <div className="bg-primary/10 px-6 py-4 shrink-0">
          <h3 className="font-bold text-lg text-primary">Add to Inventory</h3>
          <p className="text-sm text-base-content/60 mt-0.5">
            {step === 'pick' ? 'Select one or more ingredients' : `${batch.length} ingredient${batch.length !== 1 ? 's' : ''} selected`}
          </p>
        </div>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-4">
          {step === 'pick' ? (
            <IngredientPicker
              ingredients={ingredients}
              excludeIds={existingIds}
              onConfirm={handlePickConfirm}
              confirmLabel={n => `Configure ${n} item${n !== 1 ? 's' : ''} →`}
            />
          ) : (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 self-start"
                onClick={() => setStep('pick')}
              >
                <ArrowLeft size={14} /> Back to selection
              </button>

              {/* Shared purchase date */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium">Purchase date (applies to all)</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>

              {/* Per-item servings */}
              <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                {batch.map(({ ingredient, servings }) => {
                  const expiry = calcExpiryDate(new Date(purchaseDate), ingredient.shelfLifeTier)
                  return (
                    <div key={ingredient.id} className="flex items-center gap-3 bg-base-200 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{ingredient.name}</p>
                        <p className="text-xs text-base-content/50 mt-0.5">
                          Use by {expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn btn-outline btn-xs btn-square"
                          onClick={() => setServings(ingredient.id!, servings - 1)}
                        >−</button>
                        <span className="text-base font-bold w-6 text-center">{servings}</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs btn-square"
                          onClick={() => setServings(ingredient.id!, servings + 1)}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-action px-6 pb-4 mt-0 shrink-0 border-t border-base-200 pt-3">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          {step === 'configure' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAddAll} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : `Add ${batch.length} to inventory`}
            </button>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
