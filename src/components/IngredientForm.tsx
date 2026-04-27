import { useState } from 'react'
import type { Ingredient, IngredientCategory, ShelfLifeTier, NutritionTag } from '../types'
import { CATEGORY_LABELS, SHELF_LIFE_LABELS, useIngredientStore } from '../store/ingredientStore'

const CATEGORIES: IngredientCategory[] = ['fruit', 'veg', 'meat-protein', 'dairy', 'shelf-staple', 'frozen', 'snacks', 'seasoning', 'other']
const SHELF_LIFE_TIERS: ShelfLifeTier[] = ['very-perishable', 'perishable', 'stable', 'shelf-stable']
const ALL_TAGS: NutritionTag[] = [
  'high-protein', 'high-fibre', 'high-carb', 'high-fat', 'high-iron',
  'high-calcium', 'high-magnesium', 'high-vitamin-c', 'high-vitamin-d', 'high-omega-3',
  'low-calorie', 'low-fat', 'low-carb', 'low-sugar', 'low-sodium',
]

interface Props {
  ingredient?: Ingredient
  onClose: () => void
}

export function IngredientForm({ ingredient, onClose }: Props) {
  const { addIngredient, updateIngredient } = useIngredientStore()
  const isEdit = !!ingredient

  const [name, setName] = useState(ingredient?.name ?? '')
  const [category, setCategory] = useState<IngredientCategory>(ingredient?.category ?? 'other')
  const [shelfLifeTier, setShelfLifeTier] = useState<ShelfLifeTier>(ingredient?.shelfLifeTier ?? 'perishable')
  const [storageNotes, setStorageNotes] = useState(ingredient?.storageNotes ?? '')
  const [nutritionTags, setNutritionTags] = useState<NutritionTag[]>(ingredient?.nutritionTags ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit && ingredient.id != null) {
        await updateIngredient(ingredient.id, { name: name.trim(), category, shelfLifeTier, storageNotes: storageNotes.trim() || undefined, nutritionTags: nutritionTags.length ? nutritionTags : undefined })
      } else {
        await addIngredient({ name: name.trim(), category, shelfLifeTier, storageNotes: storageNotes.trim() || undefined, nutritionTags: nutritionTags.length ? nutritionTags : undefined })
      }
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">{isEdit ? 'Edit Ingredient' : 'New Ingredient'}</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="form-control">
            <div className="label"><span className="label-text">Name *</span></div>
            <input
              className="input input-bordered"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken Breast"
              autoFocus
            />
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">Category</span></div>
            <select className="select select-bordered" value={category} onChange={e => setCategory(e.target.value as IngredientCategory)}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">Shelf life</span></div>
            <select className="select select-bordered" value={shelfLifeTier} onChange={e => setShelfLifeTier(e.target.value as ShelfLifeTier)}>
              {SHELF_LIFE_TIERS.map(t => (
                <option key={t} value={t}>{SHELF_LIFE_LABELS[t]}</option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">Storage notes <span className="text-base-content/50">(optional)</span></span></div>
            <textarea
              className="textarea textarea-bordered"
              value={storageNotes}
              onChange={e => setStorageNotes(e.target.value)}
              placeholder="e.g. Keep in fridge, away from strong odours"
              rows={2}
            />
          </label>

          <div className="form-control">
            <div className="label"><span className="label-text">Nutrition tags <span className="text-base-content/50">(optional)</span></span></div>
            <div className="flex flex-wrap gap-1">
              {ALL_TAGS.map(tag => {
                const active = nutritionTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNutritionTags(active ? nutritionTags.filter(t => t !== tag) : [...nutritionTags, tag])}
                    className={`badge cursor-pointer select-none ${active ? 'badge-primary' : 'badge-ghost'}`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : isEdit ? 'Save changes' : 'Add ingredient'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
