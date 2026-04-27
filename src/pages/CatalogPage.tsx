import { useState, useMemo, useEffect } from 'react'
import { useIngredientStore, CATEGORY_ORDER, CATEGORY_LABELS } from '../store/ingredientStore'
import type { IngredientCategory } from '../types'
import type { Ingredient } from '../types'
import { SearchInput, CategoryFilter, ShelfLifeBadge } from '../components/CatalogFilters'
import { IngredientForm } from '../components/IngredientForm'

export function CatalogPage() {
  const { ingredients, loading, loadIngredients, deleteIngredient } = useIngredientStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | undefined>()
  const [confirmDelete, setConfirmDelete] = useState<Ingredient | null>(null)

  useEffect(() => { loadIngredients() }, [loadIngredients])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ingredients.filter(i =>
      (categoryFilter === 'all' || i.category === categoryFilter) &&
      (!q || i.name.toLowerCase().includes(q))
    )
  }, [ingredients, search, categoryFilter])

  const grouped = useMemo(() => {
    const map = new Map<IngredientCategory, typeof filtered>()
    CATEGORY_ORDER.forEach(c => {
      const items = filtered.filter(i => i.category === c)
      if (items.length) map.set(c, items)
    })
    return map
  }, [filtered])

  const handleEdit = (ingredient: Ingredient) => {
    setEditing(ingredient)
    setFormOpen(true)
  }

  const handleDelete = async (ingredient: Ingredient) => {
    if (ingredient.id != null) await deleteIngredient(ingredient.id)
    setConfirmDelete(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ingredient Catalog</h1>
          <p className="text-base-content/60 text-sm mt-1">{ingredients.length} ingredients</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
          + New ingredient
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Search ingredients…" />
        <CategoryFilter value={categoryFilter} onChange={setCategoryFilter} />
      </div>

      {loading && <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-base-content/50">
          {search || categoryFilter !== 'all' ? 'No ingredients match your search.' : 'No ingredients yet.'}
        </div>
      )}

      {!loading && [...grouped.entries()].map(([category, items]) => (
        <div key={category} className="mb-6">
          <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="flex flex-col gap-1">
            {items.map(ingredient => (
              <div key={ingredient.id} className="card card-compact bg-base-200 hover:bg-base-300 transition-colors">
                <div className="card-body flex-row items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{ingredient.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <ShelfLifeBadge tier={ingredient.shelfLifeTier} />
                      {ingredient.nutritionTags?.map(tag => (
                        <span key={tag} className="badge badge-ghost badge-sm">{tag}</span>
                      ))}
                    </div>
                    {ingredient.storageNotes && (
                      <p className="text-xs text-base-content/50 mt-1 truncate">{ingredient.storageNotes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="btn btn-ghost btn-xs" onClick={() => handleEdit(ingredient)} aria-label="Edit">✏️</button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => setConfirmDelete(ingredient)} aria-label="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {formOpen && (
        <IngredientForm
          ingredient={editing}
          onClose={() => { setFormOpen(false); setEditing(undefined) }}
        />
      )}

      {confirmDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Delete {confirmDelete.name}?</h3>
            <p className="py-4 text-base-content/70">This will remove it from the catalog. Any inventory items using it will be unaffected.</p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-error" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setConfirmDelete(null)} />
        </dialog>
      )}
    </div>
  )
}
