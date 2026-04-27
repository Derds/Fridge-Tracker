import { useState, useMemo, useEffect } from 'react'
import type { Meal } from '../types'
import { useIngredientStore } from '../store/ingredientStore'

interface IngredientEntry {
  ingredientId: number
  servings: number
}

interface Props {
  meal?: Meal
  onSave: (data: Omit<Meal, 'id' | 'createdAt'>) => Promise<void>
  onClose: () => void
}

export function MealForm({ meal, onSave, onClose }: Props) {
  const { ingredients, loadIngredients } = useIngredientStore()
  const [name, setName] = useState(meal?.name ?? '')
  const [notes, setNotes] = useState(meal?.notes ?? '')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<IngredientEntry[]>(meal?.ingredients ?? [])
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
    setEntries(e => [...e, { ingredientId: id, servings: 1 }])
    setSearch('')
  }

  function updateServings(id: number, val: number) {
    setEntries(e => e.map(x => x.ingredientId === id ? { ...x, servings: Math.max(1, val) } : x))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), notes: notes.trim() || undefined, ingredients: entries })
      onClose()
    } catch {
      setError('Something went wrong — please try again')
      setSaving(false)
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-lg overflow-visible">
        <h3 className="font-bold text-lg mb-4">{meal ? 'Edit meal' : 'New meal'}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="form-control">
            <div className="label"><span className="label-text">Name</span></div>
            <input
              className="input input-bordered"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Spaghetti bolognese"
              autoFocus
            />
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">Notes <span className="text-base-content/50">(optional)</span></span></div>
            <textarea
              className="textarea textarea-bordered"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Use fresh pasta if possible"
            />
          </label>

          <div className="form-control">
            <div className="label"><span className="label-text">Ingredients</span></div>

            {entries.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {entries.map(entry => {
                  const ing = ingredientMap.get(entry.ingredientId)
                  return (
                    <div key={entry.ingredientId} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-1.5">
                      <span className="flex-1 text-sm">{ing?.name ?? '—'}</span>
                      <input
                        type="number"
                        min={1}
                        value={entry.servings}
                        onChange={e => updateServings(entry.ingredientId, Number(e.target.value))}
                        className="input input-bordered input-xs w-16 text-center"
                      />
                      <span className="text-xs text-base-content/50">srv</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                        onClick={() => setEntries(e => e.filter(x => x.ingredientId !== entry.ingredientId))}
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Search to add ingredient */}
            <div className="relative">
              <label className="input input-bordered input-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-50 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
                </svg>
                <input
                  className="grow"
                  placeholder="Search ingredients to add…"
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

          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : meal ? 'Save changes' : 'Create meal'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
