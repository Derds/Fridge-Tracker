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
import type { Ingredient, Meal, MealPlanDay } from '../types'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  onNavigateToShopping: () => void
}

export function MealsPage({ onNavigateToShopping }: Props) {
  const [subTab, setSubTab] = useState<'gallery' | 'planner'>('gallery')
  const [showForm, setShowForm] = useState(false)
  const [editMeal, setEditMeal] = useState<Meal | undefined>()
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addMealForDay, setAddMealForDay] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [generatedMsg, setGeneratedMsg] = useState(false)

  const { meals, loadMeals, addMeal, updateMeal, deleteMeal } = useMealStore()
  const { plan, weekStart, loading: planLoading, loadWeek, addMealToDay, removeMealFromDay } = useWeekPlannerStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory } = useInventoryStore()
  const { loadOrCreateList, addToPotential } = useShoppingStore()

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  useEffect(() => {
    loadMeals()
    loadIngredients()
    loadWeek()
    loadOrCreateList()
    loadInventory()
  }, [loadMeals, loadIngredients, loadWeek, loadOrCreateList, loadInventory])

  // Default selected day to today (or first day of week)
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
    () => plan?.days.reduce((n, d) => n + d.mealIds.length, 0) ?? 0,
    [plan]
  )

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
    const overId = over.id as string
    if (mealId != null && overId.startsWith('day-')) {
      addMealToDay(overId.slice(4), mealId)
    }
  }

  async function handleGenerateShopping() {
    if (!plan) return
    const inStock = new Set(inventory.filter(i => i.servingsRemaining > 0).map(i => i.ingredientId))
    const needed = new Set<number>()
    for (const day of plan.days) {
      for (const mealId of day.mealIds) {
        const meal = mealMap.get(mealId)
        if (meal) meal.ingredients.forEach(({ ingredientId }) => needed.add(ingredientId))
      }
      day.ingredientIds.forEach(id => needed.add(id))
    }
    for (const ingredientId of needed) {
      if (!inStock.has(ingredientId)) await addToPotential(ingredientId, 'meal-plan')
    }
    setGeneratedMsg(true)
    setTimeout(() => setGeneratedMsg(false), 3000)
  }

  function navigateWeek(offset: number) {
    const [y, m, d] = weekStart.split('-').map(Number)
    loadWeek(getMonday(new Date(y, m - 1, d + offset)))
    setSelectedDay(null)
  }

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      {/* Sub-tabs */}
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button role="tab" className={`tab ${subTab === 'gallery' ? 'tab-active' : ''}`} onClick={() => setSubTab('gallery')}>
          Meals {meals.length > 0 && <span className="badge badge-sm ml-1">{meals.length}</span>}
        </button>
        <button role="tab" className={`tab ${subTab === 'planner' ? 'tab-active' : ''}`} onClick={() => setSubTab('planner')}>
          Week plan {plannedCount > 0 && <span className="badge badge-sm ml-1">{plannedCount}</span>}
        </button>
      </div>

      {/* ── Gallery ──────────────────────────────────────────────────── */}
      {subTab === 'gallery' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Meals</h1>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditMeal(undefined); setShowForm(true) }}>
              + New meal
            </button>
          </div>

          {meals.length === 0 ? (
            <div className="text-center py-12 text-base-content/40">
              <p className="text-5xl mb-3">🍽️</p>
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
          {/* Week nav */}
          <div className="flex items-center justify-between mb-5">
            <button className="btn btn-ghost btn-sm" onClick={() => navigateWeek(-7)}>←</button>
            <span className="font-semibold text-sm sm:text-base">{formatWeekLabel(weekStart)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateWeek(7)}>→</button>
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
                      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
                        {meals.map(meal => <DraggableMeal key={meal.id} meal={meal} />)}
                      </div>
                    )}
                  </div>

                  {/* 7-column grid */}
                  <div className="flex-1 grid grid-cols-7 gap-1.5 overflow-x-auto min-w-0">
                    {weekDays.map((date, i) => {
                      const day = plan?.days.find(d => d.date === date) ?? { date, mealIds: [], ingredientIds: [] }
                      return (
                        <DroppableDay
                          key={date}
                          date={date}
                          day={day}
                          dayName={DAY_NAMES[i]}
                          mealMap={mealMap}
                          onRemoveMeal={mealId => removeMealFromDay(date, mealId)}
                          onClickAdd={() => setAddMealForDay(date)}
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

              {/* ── Mobile: day tabs + single day view ── */}
              <div className="sm:hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 snap-x">
                  {weekDays.map((date, i) => {
                    const hasMeals = (plan?.days.find(d => d.date === date)?.mealIds.length ?? 0) > 0
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
                  const day = plan?.days.find(d => d.date === selectedDay) ?? { date: selectedDay, mealIds: [], ingredientIds: [] }
                  return (
                    <div>
                      <p className="font-semibold mb-3 text-sm">{formatDayLabel(selectedDay, 'full')}</p>
                      {day.mealIds.length === 0 ? (
                        <p className="text-sm text-base-content/40 mb-3 italic">Nothing planned yet</p>
                      ) : (
                        <div className="flex flex-col gap-1.5 mb-3">
                          {day.mealIds.map(mealId => (
                            <div key={mealId} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
                              <span className="flex-1 text-sm font-medium">{mealMap.get(mealId)?.name ?? '—'}</span>
                              <button
                                className="btn btn-ghost btn-xs opacity-40 hover:opacity-100"
                                onClick={() => removeMealFromDay(selectedDay, mealId)}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button className="btn btn-outline btn-sm w-full" onClick={() => setAddMealForDay(selectedDay)}>
                        + Add meal
                      </button>
                    </div>
                  )
                })()}
              </div>

              {/* Generate shopping list */}
              <div className="mt-6 pt-4 border-t border-base-200 flex items-center justify-end gap-3">
                {generatedMsg && (
                  <span className="text-sm text-success">
                    ✓ Added to shopping suggestions —{' '}
                    <button className="underline" onClick={onNavigateToShopping}>view list</button>
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  disabled={plannedCount === 0}
                  onClick={handleGenerateShopping}
                >
                  Generate shopping list
                </button>
              </div>
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

      {/* Click-to-add meal to day modal */}
      {addMealForDay && (
        <AddMealToDayModal
          meals={meals}
          plannedMealIds={plan?.days.find(d => d.date === addMealForDay)?.mealIds ?? []}
          onAdd={async (mealId) => { await addMealToDay(addMealForDay, mealId); setAddMealForDay(null) }}
          onClose={() => setAddMealForDay(null)}
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
            <button className="btn btn-ghost btn-xs" onClick={onEdit} aria-label="Edit">✏️</button>
            <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={onDelete} aria-label="Delete">🗑️</button>
          </div>
        </div>
        {meal.notes && <p className="text-sm text-base-content/60 line-clamp-2 mt-1">{meal.notes}</p>}
        {meal.ingredients.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.ingredients.slice(0, 5).map(({ ingredientId }) => {
              const ing = ingredientMap.get(ingredientId)
              return ing ? <span key={ingredientId} className="badge badge-ghost badge-sm">{ing.name}</span> : null
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
    </div>
  )
}

function DroppableDay({ date, day, dayName, mealMap, onRemoveMeal, onClickAdd }: {
  date: string
  day: MealPlanDay
  dayName: string
  mealMap: Map<number, Meal>
  onRemoveMeal: (mealId: number) => void
  onClickAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}` })
  const dateNum = date.split('-')[2]

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-28 rounded-lg border transition-colors p-1.5 ${isOver ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-50'}`}
    >
      <div className="text-center mb-1.5">
        <p className="text-xs font-semibold text-base-content/50">{dayName}</p>
        <p className="text-sm font-bold">{dateNum}</p>
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        {day.mealIds.map(mealId => (
          <div key={mealId} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs flex items-center gap-1 group">
            <span className="flex-1 truncate">{mealMap.get(mealId)?.name ?? '—'}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-error"
              onClick={() => onRemoveMeal(mealId)}
              aria-label="Remove"
            >×</button>
          </div>
        ))}
      </div>
      <button
        className="btn btn-ghost btn-xs w-full text-base-content/30 hover:text-base-content mt-1"
        onClick={onClickAdd}
        aria-label="Add meal"
      >+</button>
    </div>
  )
}

function AddMealToDayModal({ meals, plannedMealIds, onAdd, onClose }: {
  meals: Meal[]
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
        <h3 className="font-bold text-lg mb-3">Add meal to day</h3>
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
            {meals.length === 0 ? 'No meals saved — create some in the Meals tab first' : 'All meals already added for this day'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filtered.map(meal => (
              <li key={meal.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm"
                  onClick={() => onAdd(meal.id!)}
                >
                  {meal.name}
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
