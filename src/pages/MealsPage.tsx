import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMealStore } from '../store/mealStore'
import { useWeekPlannerStore, getWeekDays, formatWeekLabel, formatDayLabel, getMonday } from '../store/weekPlannerStore'
import { useIngredientStore } from '../store/ingredientStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useShoppingStore } from '../store/shoppingStore'
import { MealForm } from '../components/MealForm'
import type { Ingredient, Meal, MealPlanDay, MealSlot } from '../types'
import {
  MEAL_SLOTS, MEAL_SLOT_LABELS,
  COOKING_TIME_LABELS, COOKING_TIME_BADGE,
  INGREDIENT_ROLE_BADGE_DISPLAY,
} from '../types'
import { ForkKnife, Plus, PencilSimple, Trash, X, ArrowLeft, ArrowRight, ShoppingCart, ChartBar, ArrowSquareOut, UploadSimple } from '@phosphor-icons/react'
import { CATEGORY_ICONS } from '../components/CatalogFilters'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../store/ingredientStore'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function exportMeals(meals: Meal[]) {
  const data = meals.map(({ name, ingredients, notes, cookingTime }) => ({ name, ingredients, notes, cookingTime }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fridge-meals-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importMeals(
  file: File,
  addMeal: (m: Omit<Meal, 'id' | 'createdAt'>) => Promise<unknown>,
  loadMeals: () => Promise<void>,
  setMsg: (m: { ok: boolean; text: string } | null) => void
) {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data)) throw new Error('Expected an array of meals')
    let imported = 0
    for (const item of data) {
      if (typeof item.name === 'string' && Array.isArray(item.ingredients)) {
        await addMeal({ name: item.name, ingredients: item.ingredients, notes: item.notes ?? '', cookingTime: item.cookingTime ?? 'medium' })
        imported++
      }
    }
    await loadMeals()
    setMsg({ ok: true, text: `Imported ${imported} meal${imported !== 1 ? 's' : ''} successfully.` })
    setTimeout(() => setMsg(null), 4000)
  } catch (e) {
    setMsg({ ok: false, text: `Import failed: ${e instanceof Error ? e.message : 'Unknown error'}` })
  }
}

interface Props {
  onNavigateToShopping: () => void
}

export function MealsPage({ onNavigateToShopping }: Props) {
  const [subTab, setSubTab] = useState<'gallery' | 'planner'>('planner')
  const [showForm, setShowForm] = useState(false)
  const [editMeal, setEditMeal] = useState<Meal | undefined>()
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addMealForSlot, setAddMealForSlot] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [reviewItems, setReviewItems] = useState<{ ingredient: Ingredient; isCore: boolean }[] | null>(null)
  const [showNutrition, setShowNutrition] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { meals, loadMeals, addMeal, updateMeal, deleteMeal } = useMealStore()
  const { plan, weekStart, loading: planLoading, loadWeek, addMealToDay, removeMealFromDay } = useWeekPlannerStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory } = useInventoryStore()
  const { loadOrCreateList, bulkAddToActual } = useShoppingStore()

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  useEffect(() => {
    loadMeals()
    loadIngredients()
    loadWeek()
    loadOrCreateList()
    loadInventory()
  }, [loadMeals, loadIngredients, loadWeek, loadOrCreateList, loadInventory])

  useEffect(() => {
    if (!selectedDay && weekDays.length) {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      setSelectedDay(weekDays.includes(today) ? today : weekDays[0])
    }
  }, [weekDays, selectedDay])

  const mealMap = useMemo(() => new Map(meals.map(m => [m.id!, m])), [meals])
  const ingredientMap = useMemo(() => new Map(ingredients.map(i => [i.id!, i])), [ingredients])

  const plannedCount = useMemo(
    () => plan?.days.reduce((n, d) => n + MEAL_SLOTS.reduce((s, slot) => s + d.slots[slot].length, 0), 0) ?? 0,
    [plan]
  )

  // Days that have at least one meal planned — used as denominator for nutrition chart
  const plannedDays = useMemo(
    () => plan?.days.filter(d => MEAL_SLOTS.some(s => d.slots[s].length > 0)).length ?? 0,
    [plan]
  )

  // Nutrition tag → number of distinct days that have at least one ingredient with that tag
  const weekNutrition = useMemo(() => {
    if (!plan) return new Map<string, number>()
    const tagDays = new Map<string, Set<string>>()
    for (const day of plan.days) {
      for (const slot of MEAL_SLOTS) {
        for (const mealId of day.slots[slot]) {
          const meal = mealMap.get(mealId)
          if (!meal) continue
          for (const { ingredientId } of meal.ingredients) {
            const ing = ingredientMap.get(ingredientId)
            for (const tag of (ing?.nutritionTags ?? [])) {
              if (!tagDays.has(tag)) tagDays.set(tag, new Set())
              tagDays.get(tag)!.add(day.date)
            }
          }
        }
      }
    }
    return new Map([...tagDays].map(([tag, days]) => [tag, days.size]))
  }, [plan, mealMap, ingredientMap])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const mealId = (event.active.data.current as { mealId?: number })?.mealId
    if (mealId != null) setActiveMeal(mealMap.get(mealId) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveMeal(null)
    const { active, over } = event
    if (!over) return
    const mealId = (active.data.current as { mealId?: number })?.mealId
    const match = (over.id as string).match(/^slot-(\d{4}-\d{2}-\d{2})-(breakfast|lunch|dinner|snack)$/)
    if (mealId != null && match) {
      addMealToDay(match[1], match[2] as MealSlot, mealId)
    }
  }

  async function handleGenerateShopping() {
    if (!plan) return
    const inStock = new Set(inventory.filter(i => i.servingsRemaining > 0).map(i => i.ingredientId))
    // Track each needed ingredient and whether it appears as 'core' in any planned meal
    const neededRoles = new Map<number, boolean>() // ingredientId → hasCore
    for (const day of plan.days) {
      for (const slot of MEAL_SLOTS) {
        for (const mealId of day.slots[slot]) {
          const meal = mealMap.get(mealId)
          if (meal) {
            meal.ingredients.forEach(({ ingredientId, role }) => {
              const isCore = role === 'core' || role == null
              // Once marked core, stays core even if optional in another meal
              neededRoles.set(ingredientId, (neededRoles.get(ingredientId) ?? false) || isCore)
            })
          }
        }
      }
    }
    const missing = [...neededRoles.entries()]
      .filter(([id]) => !inStock.has(id))
      .map(([id, isCore]) => {
        const ingredient = ingredientMap.get(id)
        return ingredient ? { ingredient, isCore } : null
      })
      .filter(Boolean) as { ingredient: Ingredient; isCore: boolean }[]

    if (missing.length === 0) {
      alert('You already have everything in stock for this week\'s meals! 🎉')
      return
    }
    setReviewItems(missing)
  }

  function navigateWeek(offset: number) {
    const [y, m, d] = weekStart.split('-').map(Number)
    loadWeek(getMonday(new Date(y, m - 1, d + offset)))
    setSelectedDay(null)
  }

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      {/* Sub-tab toggle */}
      <div className="join mb-6">
        <button
          className={`btn join-item ${subTab === 'gallery' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
          onClick={() => setSubTab('gallery')}
        >
          Meals {meals.length > 0 && <span className="badge badge-sm ml-1.5">{meals.length}</span>}
        </button>
        <button
          className={`btn join-item ${subTab === 'planner' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
          onClick={() => setSubTab('planner')}
        >
          Week plan {plannedCount > 0 && <span className="badge badge-sm ml-1.5">{plannedCount}</span>}
        </button>
      </div>

      {/* ── Gallery ──────────────────────────────────────────────────── */}
      {subTab === 'gallery' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Meals</h1>
            <div className="flex gap-2">
              {meals.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm gap-1.5 text-base-content/60"
                  onClick={() => exportMeals(meals)}
                  title="Export meals as JSON backup"
                >
                  <ArrowSquareOut size={15} /> Export
                </button>
              )}
              <label
                className="btn btn-ghost btn-sm gap-1.5 text-base-content/60 cursor-pointer"
                title="Import meals from JSON file"
              >
                <UploadSimple size={15} /> Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) importMeals(file, addMeal, loadMeals, setImportMsg)
                    e.target.value = ''
                  }}
                />
              </label>
              <button className="btn btn-primary btn-sm gap-1" onClick={() => { setEditMeal(undefined); setShowForm(true) }}>
                <Plus size={15} weight="bold" /> New meal
              </button>
            </div>
          </div>

          {importMsg && (
            <div className={`alert alert-sm mb-4 py-2 ${importMsg.ok ? 'alert-success' : 'alert-error'}`}>
              <span className="text-sm">{importMsg.text}</span>
              <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setImportMsg(null)}>✕</button>
            </div>
          )}

          {meals.length === 0 ? (
            <div className="text-center py-12 text-base-content/40">
              <ForkKnife size={48} weight="thin" className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">No meals saved yet</p>
              <p className="text-sm mt-1">Save your go-to meals to plan your week</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {meals.map(meal => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  ingredientMap={ingredientMap}
                  onEdit={() => { setEditMeal(meal); setShowForm(true) }}
                  onDelete={() => deleteMeal(meal.id!)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Week Planner ─────────────────────────────────────────────── */}
      {subTab === 'planner' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <button className="btn btn-ghost btn-sm" onClick={() => navigateWeek(-7)}><ArrowLeft size={16} /></button>
            <span className="font-semibold text-sm sm:text-base">{formatWeekLabel(weekStart)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateWeek(7)}><ArrowRight size={16} /></button>
          </div>

          {planLoading ? (
            <div className="flex justify-center py-8"><span className="loading loading-spinner" /></div>
          ) : (
            <>
              {/* ── Desktop: DnD sidebar + 7 columns ── */}
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="hidden sm:flex gap-4">
                  {/* Sidebar */}
                  <div className="w-44 flex-shrink-0">
                    <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      Drag to plan
                    </p>
                    {meals.length === 0 ? (
                      <p className="text-sm text-base-content/40 italic">No meals saved yet</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto pr-1">
                        {meals.map(meal => <DraggableMeal key={meal.id} meal={meal} />)}
                      </div>
                    )}
                  </div>

                  {/* 7-column grid */}
                  <div className="flex-1 grid grid-cols-7 gap-1.5 overflow-x-auto min-w-0">
                    {weekDays.map((date, i) => {
                      const day = plan?.days.find(d => d.date === date) ?? { date, slots: { breakfast: [], lunch: [], dinner: [], snack: [] }, ingredientIds: [] }
                      return (
                        <DroppableDay
                          key={date}
                          date={date}
                          day={day}
                          dayName={DAY_NAMES[i]}
                          mealMap={mealMap}
                          onRemoveMeal={(slot, mealId) => removeMealFromDay(date, slot, mealId)}
                          onClickAdd={(slot) => setAddMealForSlot({ date, slot })}
                        />
                      )
                    })}
                  </div>
                </div>

                <DragOverlay>
                  {activeMeal && (
                    <div className="bg-base-100 border border-primary rounded-lg px-3 py-2 text-sm font-medium shadow-xl opacity-95">
                      {activeMeal.name}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

              {/* ── Mobile: day tabs + slot sections ── */}
              <div className="sm:hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 snap-x">
                  {weekDays.map((date, i) => {
                    const hasMeals = MEAL_SLOTS.some(slot =>
                      (plan?.days.find(d => d.date === date)?.slots[slot].length ?? 0) > 0
                    )
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDay(date)}
                        className={`btn btn-xs flex-shrink-0 snap-start ${selectedDay === date ? 'btn-primary' : 'btn-ghost'}`}
                      >
                        {DAY_NAMES[i]}
                        {hasMeals && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 ml-0.5" />}
                      </button>
                    )
                  })}
                </div>

                {selectedDay && (() => {
                  const day = plan?.days.find(d => d.date === selectedDay) ?? { date: selectedDay, slots: { breakfast: [], lunch: [], dinner: [], snack: [] }, ingredientIds: [] }
                  return (
                    <div>
                      <p className="font-semibold mb-4 text-sm">{formatDayLabel(selectedDay, 'full')}</p>
                      {MEAL_SLOTS.map(slot => (
                        <div key={slot} className="mb-4">
                          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1.5">
                            {MEAL_SLOT_LABELS[slot]}
                          </p>
                          {day.slots[slot].length === 0 ? (
                            <p className="text-xs text-base-content/30 italic mb-1.5">Nothing planned</p>
                          ) : (
                            <div className="flex flex-col gap-1 mb-1.5">
                              {day.slots[slot].map(mealId => (
                                <div key={mealId} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
                                  <span className="flex-1 text-sm font-medium">{mealMap.get(mealId)?.name ?? '—'}</span>
                                  <button
                                    className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                                    onClick={() => removeMealFromDay(selectedDay, slot, mealId)}
                                  ><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            className="btn btn-outline btn-xs w-full gap-1"
                            onClick={() => setAddMealForSlot({ date: selectedDay, slot })}
                          >
                            <Plus size={12} /> Add to {MEAL_SLOT_LABELS[slot].toLowerCase()}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Generate shopping list + nutrition toggle */}
              <div className="mt-6 pt-4 border-t border-base-200 flex items-center justify-between gap-3">
                <button
                  className="btn btn-ghost btn-xs gap-1.5 text-base-content/50"
                  onClick={() => setShowNutrition(v => !v)}
                  disabled={plannedDays === 0}
                  title="Show nutrition balance for this week"
                >
                  <ChartBar size={14} />
                  {showNutrition ? 'Hide nutrition' : 'Nutrition summary'}
                </button>
                <button
                  className="btn btn-primary btn-sm gap-1.5"
                  disabled={plannedCount === 0}
                  onClick={handleGenerateShopping}
                >
                  <ShoppingCart size={15} weight="bold" /> Generate shopping list
                </button>
              </div>

              {/* Nutrition balance chart — hidden by default */}
              {showNutrition && plannedDays > 0 && (
                <NutritionSummaryPanel tagCoverage={weekNutrition} plannedDays={plannedDays} />
              )}
            </>
          )}
        </div>
      )}

      {/* Meal form modal */}
      {showForm && (
        <MealForm
          meal={editMeal}
          onSave={async (data) => {
            if (editMeal?.id != null) await updateMeal(editMeal.id, data)
            else await addMeal(data)
          }}
          onClose={() => { setShowForm(false); setEditMeal(undefined) }}
        />
      )}

      {/* Click-to-add meal to slot modal */}
      {addMealForSlot && (
        <AddMealToDayModal
          meals={meals}
          slot={addMealForSlot.slot}
          plannedMealIds={plan?.days.find(d => d.date === addMealForSlot.date)?.slots[addMealForSlot.slot] ?? []}
          onAdd={async (mealId) => {
            await addMealToDay(addMealForSlot.date, addMealForSlot.slot, mealId)
            setAddMealForSlot(null)
          }}
          onClose={() => setAddMealForSlot(null)}
        />
      )}

      {/* Shopping review modal */}
      {reviewItems && (
        <ShoppingReviewModal
          items={reviewItems}
          onConfirm={async (selected) => {
            await bulkAddToActual(selected)
            setReviewItems(null)
            onNavigateToShopping()
          }}
          onClose={() => setReviewItems(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MealCard({ meal, ingredientMap, onEdit, onDelete }: {
  meal: Meal
  ingredientMap: Map<number, Ingredient>
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="card-title text-base leading-snug">{meal.name}</h3>
          <div className="flex gap-1 flex-shrink-0">
            <button className="btn btn-ghost btn-xs" onClick={onEdit} aria-label="Edit"><PencilSimple size={15} /></button>
            <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={onDelete} aria-label="Delete"><Trash size={15} /></button>
          </div>
        </div>
        {meal.cookingTime && (
          <span className={`badge badge-sm mt-1 ${COOKING_TIME_BADGE[meal.cookingTime]}`}>
            {COOKING_TIME_LABELS[meal.cookingTime]}
          </span>
        )}
        {meal.notes && <p className="text-sm text-base-content/60 line-clamp-2 mt-1">{meal.notes}</p>}
        {meal.ingredients.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.ingredients.slice(0, 5).map(({ ingredientId, role }) => {
              const ing = ingredientMap.get(ingredientId)
              if (!ing) return null
              const roleClass = role && role !== 'core' ? INGREDIENT_ROLE_BADGE_DISPLAY[role] : 'badge-ghost'
              return (
                <span key={ingredientId} className={`badge badge-sm ${roleClass}`}>
                  {ing.name}
                </span>
              )
            })}
            {meal.ingredients.length > 5 && (
              <span className="badge badge-ghost badge-sm">+{meal.ingredients.length - 5} more</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-base-content/40 mt-2 italic">No ingredients listed</p>
        )}
      </div>
    </div>
  )
}

function DraggableMeal({ meal }: { meal: Meal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `meal-${meal.id}`,
    data: { mealId: meal.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: 'none',
      }}
      {...listeners}
      {...attributes}
      className={`bg-base-200 rounded-lg px-3 py-2 text-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${isDragging ? 'opacity-30' : 'hover:bg-base-300'}`}
    >
      {meal.name}
      {meal.cookingTime && (
        <span className={`badge badge-xs ml-2 ${COOKING_TIME_BADGE[meal.cookingTime]}`} />
      )}
    </div>
  )
}

function DroppableSlot({ date, slot, mealIds, mealMap, onRemoveMeal, onClickAdd }: {
  date: string
  slot: MealSlot
  mealIds: number[]
  mealMap: Map<number, Meal>
  onRemoveMeal: (mealId: number) => void
  onClickAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${date}-${slot}` })
  const abbrev: Record<MealSlot, string> = { breakfast: 'Bkfst', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col p-1 min-h-[52px] transition-colors border-b border-base-200 last:border-b-0 ${isOver ? 'bg-primary/10' : ''}`}
    >
      <p className="text-[9px] text-base-content/30 font-semibold uppercase tracking-wide mb-0.5">{abbrev[slot]}</p>
      <div className="flex flex-col gap-0.5 flex-1">
        {mealIds.map(mealId => (
          <div key={mealId} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs flex items-center gap-1 group">
            <span className="flex-1 truncate">{mealMap.get(mealId)?.name ?? '—'}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-error transition-opacity"
              onClick={() => onRemoveMeal(mealId)}
              aria-label="Remove"
            ><X size={10} /></button>
          </div>
        ))}
      </div>
      <button
        className="text-base-content/20 hover:text-base-content/50 transition-colors flex items-center justify-center mt-0.5"
        onClick={onClickAdd}
        aria-label={`Add to ${slot}`}
      >
        <Plus size={11} />
      </button>
    </div>
  )
}

function DroppableDay({ date, day, dayName, mealMap, onRemoveMeal, onClickAdd }: {
  date: string
  day: MealPlanDay
  dayName: string
  mealMap: Map<number, Meal>
  onRemoveMeal: (slot: MealSlot, mealId: number) => void
  onClickAdd: (slot: MealSlot) => void
}) {
  const dateNum = date.split('-')[2]

  return (
    <div className="flex flex-col rounded-lg border border-base-300 bg-base-50 overflow-hidden">
      <div className="text-center py-1.5 bg-base-200 border-b border-base-300">
        <p className="text-xs font-semibold text-base-content/50">{dayName}</p>
        <p className="text-sm font-bold">{dateNum}</p>
      </div>
      <div className="flex flex-col flex-1">
        {MEAL_SLOTS.map(slot => (
          <DroppableSlot
            key={slot}
            date={date}
            slot={slot}
            mealIds={day.slots[slot]}
            mealMap={mealMap}
            onRemoveMeal={(mealId) => onRemoveMeal(slot, mealId)}
            onClickAdd={() => onClickAdd(slot)}
          />
        ))}
      </div>
    </div>
  )
}

function AddMealToDayModal({ meals, slot, plannedMealIds, onAdd, onClose }: {
  meals: Meal[]
  slot: MealSlot
  plannedMealIds: number[]
  onAdd: (mealId: number) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const planned = new Set(plannedMealIds)
  const filtered = meals.filter(m =>
    !planned.has(m.id!) && (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg mb-0.5">Add meal</h3>
        <p className="text-sm text-base-content/50 mb-3">{MEAL_SLOT_LABELS[slot]}</p>
        <label className="input input-bordered input-sm flex items-center gap-2 mb-3">
          <input
            className="grow"
            placeholder="Search meals…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </label>
        {filtered.length === 0 ? (
          <p className="text-sm text-base-content/40 py-4 text-center">
            {meals.length === 0 ? 'No meals saved — create some in the Meals tab first' : 'All meals already added for this slot'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filtered.map(meal => (
              <li key={meal.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm flex items-center justify-between"
                  onClick={() => onAdd(meal.id!)}
                >
                  <span>{meal.name}</span>
                  {meal.cookingTime && (
                    <span className={`badge badge-xs ${COOKING_TIME_BADGE[meal.cookingTime]}`}>
                      {COOKING_TIME_LABELS[meal.cookingTime]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-action mt-3">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

function ShoppingReviewModal({ items, onConfirm, onClose }: {
  items: { ingredient: Ingredient; isCore: boolean }[]
  onConfirm: (selected: number[]) => Promise<void>
  onClose: () => void
}) {
  // Pre-select only core ingredients
  const coreIds = items.filter(i => i.isCore).map(i => i.ingredient.id!)
  const [selected, setSelected] = useState<Set<number>>(new Set(coreIds))

  const coreItems = items.filter(i => i.isCore)
  const optionalItems = items.filter(i => !i.isCore)

  const grouped = (subset: Ingredient[]) =>
    CATEGORY_ORDER.map(cat => ({
      cat,
      items: subset.filter(i => i.category === cat),
    })).filter(g => g.items.length > 0)

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll(ids: number[], checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  function IngredientGroup({ title, subtitle, ingredients, accent }: {
    title: string
    subtitle: string
    ingredients: Ingredient[]
    accent: string
  }) {
    if (ingredients.length === 0) return null
    const ids = ingredients.map(i => i.id!)
    const allChecked = ids.every(id => selected.has(id))
    return (
      <div>
        <div className={`flex items-center justify-between mb-2 pb-1.5 border-b ${accent}`}>
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-base-content/50">{subtitle}</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={allChecked}
              onChange={e => toggleAll(ids, e.target.checked)}
            />
            All
          </label>
        </div>
        {grouped(ingredients).map(({ cat, items: catItems }) => {
          const Icon = CATEGORY_ICONS[cat]
          return (
            <div key={cat} className="mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1">
                <Icon size={13} />
                <span>{CATEGORY_LABELS[cat]}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {catItems.map(ing => (
                  <label key={ing.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={selected.has(ing.id!)}
                      onChange={() => toggle(ing.id!)}
                    />
                    <span className="text-sm">{ing.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Attach isCore back onto the ingredient objects for the group renderer
  const coreIngredients = coreItems.map(i => i.ingredient)
  const optionalIngredients = optionalItems.map(i => i.ingredient)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-md p-0 overflow-hidden">
        <div className="bg-primary/10 px-6 py-4 shrink-0">
          <h3 className="font-bold text-lg text-primary">Shopping list from meal plan</h3>
          <p className="text-sm text-base-content/60 mt-0.5">
            Core ingredients are pre-selected. Optional ones are yours to add.
          </p>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto flex flex-col gap-5">
          <IngredientGroup
            title="Core ingredients"
            subtitle="Required for your planned meals"
            ingredients={coreIngredients}
            accent="border-primary/30"
          />
          <IngredientGroup
            title="Optional / substitutes"
            subtitle="Not pre-selected — add what you want"
            ingredients={optionalIngredients}
            accent="border-base-content/20"
          />
        </div>

        <div className="flex items-center justify-between px-6 pb-4 pt-3 border-t border-base-200">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm gap-1.5"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
          >
            <ShoppingCart size={14} weight="bold" />
            Add {selected.size} to list
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

// ── Nutrition summary ─────────────────────────────────────────────────────────

const NUTRITION_GROUPS = [
  {
    label: 'Macros & fats',
    barClass: 'bg-success',
    dims: [
      { tag: 'high-protein',  label: 'Protein'   },
      { tag: 'high-fibre',    label: 'Fibre'     },
      { tag: 'high-carb',     label: 'Carbs'     },
      { tag: 'high-fat',      label: 'Healthy fats' },
      { tag: 'high-omega-3',  label: 'Omega‑3'   },
    ],
  },
  {
    label: 'Minerals',
    barClass: 'bg-info',
    dims: [
      { tag: 'high-iron',      label: 'Iron'      },
      { tag: 'high-calcium',   label: 'Calcium'   },
      { tag: 'high-magnesium', label: 'Magnesium' },
    ],
  },
  {
    label: 'Vitamins',
    barClass: 'bg-secondary',
    dims: [
      { tag: 'high-vitamin-c', label: 'Vitamin C' },
      { tag: 'high-vitamin-d', label: 'Vitamin D' },
    ],
  },
]

function NutritionBar({ label, days, total, barClass }: {
  label: string
  days: number
  total: number
  barClass: string
}) {
  const pct = total > 0 ? Math.round((days / total) * 100) : 0
  // Never use the same colour as the track (bg-base-300) for the fill
  const fill = days === 0 ? '' : pct >= 57 ? barClass : pct >= 28 ? 'bg-warning' : 'bg-base-content/25'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-base-content/60 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
        {fill && (
          <div
            className={`h-full rounded-full transition-all duration-500 ${fill}`}
            style={{ width: `${Math.max(pct, 6)}%` }}
          />
        )}
      </div>
      <span className="text-[10px] text-base-content/40 w-8 text-right tabular-nums">{days}/{total}d</span>
    </div>
  )
}

function NutritionSummaryPanel({ tagCoverage, plannedDays }: {
  tagCoverage: Map<string, number>
  plannedDays: number
}) {
  const covered = NUTRITION_GROUPS.flatMap(g => g.dims).filter(d => (tagCoverage.get(d.tag) ?? 0) > 0).length
  const total   = NUTRITION_GROUPS.flatMap(g => g.dims).length

  return (
    <div className="mt-4 bg-base-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Nutrition balance</h3>
        <span className="text-xs text-base-content/50">
          {covered}/{total} nutrients tracked · {plannedDays} day{plannedDays !== 1 ? 's' : ''} planned
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {NUTRITION_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wide mb-1.5">
              {group.label}
            </p>
            <div className="flex flex-col gap-1.5">
              {group.dims.map(dim => (
                <NutritionBar
                  key={dim.tag}
                  label={dim.label}
                  days={tagCoverage.get(dim.tag) ?? 0}
                  total={plannedDays}
                  barClass={group.barClass}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-base-content/30 mt-3 leading-relaxed">
        Coverage is based on nutrition tags on your ingredients. Add tags in the Ingredients page to improve accuracy.
      </p>
    </div>
  )
}
