import { useState, useMemo, useEffect } from 'react'
import type { MealToTry, CookingTime, IngredientRole } from '../types'
import { COOKING_TIME_LABELS, INGREDIENT_ROLE_LABELS, INGREDIENT_ROLE_BADGE } from '../types'
import { useIngredientStore } from '../store/ingredientStore'
import { MagnifyingGlass, X, Link } from '@phosphor-icons/react'

interface IngredientEntry {
  ingredientId: number
  servings: number
  role: IngredientRole
}

interface Props {
  item?: MealToTry
  onSave: (data: Omit<MealToTry, 'id' | 'createdAt' | 'tried'>) => Promise<void>
  onClose: () => void
}

export function MealToTryForm({ item, onSave, onClose }: Props) {
  const { ingredients, loadIngredients } = useIngredientStore()
  const [title, setTitle] = useState(item?.title ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [cookingTime, setCookingTime] = useState<CookingTime>(item?.cookingTime ?? 'medium')
  const [isVegetarian, setIsVegetarian] = useState(item?.isVegetarian ?? false)
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<IngredientEntry[]>(
    item?.ingredients.map(e => ({ ...e, role: e.role ?? 'core' })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadIngredients() }, [loadIngredients])

  const addedIds = useMemo(() => new Set(entries.map(e => e.ingredientId)), [entries])

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return ingredients
      .filter(i => i.id != null && !addedIds.has(i.id!) && i.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, ingredients, addedIds])

  const ingredientMap = useMemo(() => new Map(ingredients.map(i => [i.id!, i])), [ingredients])

  function addIngredient(id: number) {
    setEntries(e => [...e, { ingredientId: id, servings: 1, role: 'core' }])
    setSearch('')
  }

  function cycleRole(id: number) {
    const order: IngredientRole[] = ['core', 'optional', 'substitute']
    setEntries(e => e.map(x => {
      if (x.ingredientId !== id) return x
      const next = order[(order.indexOf(x.role) + 1) % order.length]
      return { ...x, role: next }
    }))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), url: url.trim() || undefined, notes: notes.trim() || undefined, cookingTime, isVegetarian, ingredients: entries })
      onClose()
    } catch {
      setError('Something went wrong — please try again')
      setSaving(false)
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-lg overflow-visible p-0">
        <div className="bg-accent/20 px-6 py-4">
          <h3 className="font-bold text-lg text-accent-content">{item ? 'Edit meal to try' : 'Add meal to try'}</h3>
        </div>
        <div className="px-6 pt-4 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="form-control">
              <label className="label pb-1.5"><span className="label-text font-medium">Title</span></label>
              <input
                className="input input-bordered w-full"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Jamie's one-pan chicken"
                autoFocus
              />
            </div>

            <div className="form-control">
              <label className="label pb-1.5">
                <span className="label-text font-medium">Recipe URL <span className="text-base-content/50 font-normal">(optional)</span></span>
              </label>
              <label className="input input-bordered flex items-center gap-2">
                <Link size={16} className="opacity-50 flex-shrink-0" />
                <input
                  className="grow"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://…"
                  type="url"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label pb-1.5"><span className="label-text font-medium">Cooking time</span></label>
                <select
                  className="select select-bordered w-full"
                  value={cookingTime}
                  onChange={e => setCookingTime(e.target.value as CookingTime)}
                >
                  <option value="very-quick">{COOKING_TIME_LABELS['very-quick']}</option>
                  <option value="quick">{COOKING_TIME_LABELS['quick']}</option>
                  <option value="medium">{COOKING_TIME_LABELS['medium']}</option>
                  <option value="decadent">{COOKING_TIME_LABELS['decadent']}</option>
                </select>
              </div>
              <div className="form-control flex flex-col justify-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-success"
                    checked={isVegetarian}
                    onChange={e => setIsVegetarian(e.target.checked)}
                  />
                  <span className="label-text font-medium">🌿 Vegetarian</span>
                </label>
              </div>
            </div>

            <div className="form-control">
              <label className="label pb-1.5"><span className="label-text font-medium">Notes <span className="text-base-content/50 font-normal">(optional)</span></span></label>
              <textarea
                className="textarea textarea-bordered w-full"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Why do you want to try this? Any tweaks in mind?"
              />
            </div>

            <div className="form-control">
              <label className="label pb-1.5"><span className="label-text font-medium">Ingredients <span className="text-base-content/50 font-normal">(optional)</span></span></label>
              {entries.length > 0 && (
                <div className="flex flex-col gap-1 mb-2">
                  {entries.map(entry => {
                    const ing = ingredientMap.get(entry.ingredientId)
                    const roleBadge = INGREDIENT_ROLE_BADGE[entry.role]
                    return (
                      <div key={entry.ingredientId} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-1.5">
                        <span className="flex-1 text-sm">{ing?.name ?? '—'}</span>
                        <button
                          type="button"
                          onClick={() => cycleRole(entry.ingredientId)}
                          className={`btn btn-xs cursor-pointer select-none transition-colors ${roleBadge ?? 'btn-outline btn-ghost'}`}
                          title="Click to cycle: core → optional → substitute"
                        >
                          ↻ {INGREDIENT_ROLE_LABELS[entry.role]}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                          onClick={() => setEntries(e => e.filter(x => x.ingredientId !== entry.ingredientId))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="relative">
                <label className="input input-bordered input-sm flex items-center gap-2">
                  <MagnifyingGlass size={16} className="opacity-50 flex-shrink-0" />
                  <input
                    className="grow"
                    placeholder="Search ingredients to tag…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </label>
                {searchResults.length > 0 && (
                  <ul className="absolute z-20 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1 overflow-hidden">
                    {searchResults.map(i => (
                      <li key={i.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-base-200 text-sm"
                          onClick={() => addIngredient(i.id!)}
                        >
                          {i.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {error && <p className="text-error text-sm">{error}</p>}

            <div className="modal-action mt-1">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-accent" disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : item ? 'Save changes' : 'Add to list'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
