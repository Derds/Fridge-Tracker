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
import { useMealToTryStore } from '../store/mealToTryStore'
import { MealForm } from '../components/MealForm'
import { MealToTryForm } from '../components/MealToTryForm'
import type { Ingredient, Meal, MealPlanDay, MealSlot, MealToTry } from '../types'
import {
  MEAL_SLOTS, MEAL_SLOT_LABELS,
  COOKING_TIME_LABELS, COOKING_TIME_BADGE,
  INGREDIENT_ROLE_BADGE_DISPLAY,
} from '../types'
import { ForkKnife, Plus, PencilSimple, Trash, X, ArrowLeft, ArrowRight, ShoppingCart, ChartBar, ArrowSquareOut, UploadSimple, Sparkle, Lightning, Link, CheckCircle } from '@phosphor-icons/react'
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
  const [subTab, setSubTab] = useState<'gallery' | 'planner' | 'to-try'>('planner')
  const [showForm, setShowForm] = useState(false)
  const [editMeal, setEditMeal] = useState<Meal | undefined>()
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addMealForSlot, setAddMealForSlot] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [addSnackIngForDate, setAddSnackIngForDate] = useState<string | null>(null)
  const [tryPickerFor, setTryPickerFor] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [reviewItems, setReviewItems] = useState<{ ingredient: Ingredient; isCore: boolean }[] | null>(null)
  const [showNutrition, setShowNutrition] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Meals to try state
  const [showToTryForm, setShowToTryForm] = useState(false)
  const [editToTry, setEditToTry] = useState<MealToTry | undefined>()
  const [convertToTry, setConvertToTry] = useState<MealToTry | undefined>()

  const { meals, loadMeals, addMeal, updateMeal, deleteMeal } = useMealStore()
  const { plan, weekStart, loading: planLoading, loadWeek, addMealToDay, removeMealFromDay, toggleSlotEatingOut, toggleHighEnergy, addSnackIngredient, removeSnackIngredient, addTryMealToSlot, removeTryMealFromSlot } = useWeekPlannerStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory } = useInventoryStore()
  const { loadOrCreateList, bulkAddToActual } = useShoppingStore()
  const { mealsToTry, loadMealsToTry, addMealToTry, updateMealToTry, deleteMealToTry, markTried } = useMealToTryStore()

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  useEffect(() => {
    loadMeals()
    loadIngredients()
    loadWeek()
    loadOrCreateList()
    loadInventory()
    loadMealsToTry()
  }, [loadMeals, loadIngredients, loadWeek, loadOrCreateList, loadInventory, loadMealsToTry])

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
      <div className="join mb-6 flex-wrap">
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
        <button
          className={`btn join-item gap-1.5 ${subTab === 'to-try' ? 'btn-accent' : 'btn-ghost border border-base-300'}`}
          onClick={() => setSubTab('to-try')}
        >
          <Sparkle size={14} weight={subTab === 'to-try' ? 'fill' : 'regular'} />
          Meals to try {mealsToTry.filter(m => !m.tried).length > 0 && <span className="badge badge-sm ml-0.5">{mealsToTry.filter(m => !m.tried).length}</span>}
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
                          ingredientMap={ingredientMap}
                          mealToTryMap={new Map(mealsToTry.map(m => [m.id!, m]))}
                          onRemoveMeal={(slot, mealId) => removeMealFromDay(date, slot, mealId)}
                          onClickAdd={(slot) => slot === 'snack' ? setAddSnackIngForDate(date) : setAddMealForSlot({ date, slot })}
                          onToggleSlotEatingOut={(slot) => toggleSlotEatingOut(date, slot)}
                          onToggleHighEnergy={() => toggleHighEnergy(date)}
                          onRemoveSnackIngredient={(ingId) => removeSnackIngredient(date, ingId)}
                          onClickTry={(slot) => setTryPickerFor({ date, slot })}
                          onRemoveTryMeal={(slot, id) => removeTryMealFromSlot(date, slot, id)}
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
                  const mealToTryMap = new Map(mealsToTry.map(m => [m.id!, m]))
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-semibold text-sm">{formatDayLabel(selectedDay, 'full')}</p>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-warning">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-warning"
                            checked={day.highEnergy ?? false}
                            onChange={() => toggleHighEnergy(selectedDay)}
                          />
                          <Lightning size={13} weight={day.highEnergy ? 'fill' : 'regular'} />
                          High energy
                        </label>
                      </div>
                      {MEAL_SLOTS.map(slot => {
                        const isEatingOut = day.eatingOutSlots?.[slot] ?? false
                        const tryItems = (day.tryMealSlots?.[slot] ?? []).map(id => mealToTryMap.get(id)).filter(Boolean) as MealToTry[]
                        return (
                        <div key={slot} className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
                              {MEAL_SLOT_LABELS[slot]}
                              {isEatingOut && <ForkKnife size={11} className="inline ml-1 text-secondary" weight="fill" />}
                            </p>
                            <button
                              className={`btn btn-ghost btn-xs gap-0.5 text-xs ${isEatingOut ? 'text-secondary' : 'text-base-content/30'}`}
                              onClick={() => toggleSlotEatingOut(selectedDay, slot)}
                            >
                              <ForkKnife size={11} /> {isEatingOut ? 'In' : 'Out'}
                            </button>
                          </div>
                          {day.slots[slot].length === 0 && !tryItems.length && (slot !== 'snack' || !(day.snackIngredientIds?.length)) ? (
                            <p className="text-xs text-base-content/30 italic mb-1.5">Nothing planned</p>
                          ) : (
                            <div className="flex flex-col gap-1 mb-1.5">
                              {day.slots[slot].map(mealId => (
                                <div key={mealId} className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
                                  <span className="flex-1 text-sm font-medium">{mealMap.get(mealId)?.name ?? '—'}</span>
                                  <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={() => removeMealFromDay(selectedDay, slot, mealId)}><X size={12} /></button>
                                </div>
                              ))}
                              {tryItems.map(m => (
                                <div key={m.id} className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                                  <Sparkle size={12} className="text-accent flex-shrink-0" weight="fill" />
                                  <span className="flex-1 text-sm font-medium">{m.title}</span>
                                  <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={() => removeTryMealFromSlot(selectedDay, slot, m.id!)}><X size={12} /></button>
                                </div>
                              ))}
                              {slot === 'snack' && (day.snackIngredientIds ?? []).map(ingId => (
                                <div key={ingId} className="flex items-center gap-2 bg-base-200/60 rounded-lg px-3 py-1.5">
                                  <span className="flex-1 text-sm">{ingredientMap.get(ingId)?.name ?? '—'}</span>
                                  <button className="btn btn-ghost btn-xs opacity-40 hover:opacity-100" onClick={() => removeSnackIngredient(selectedDay, ingId)}><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1">
                            {slot === 'snack' ? (
                              <button className="btn btn-outline btn-xs flex-1 gap-1" onClick={() => setAddSnackIngForDate(selectedDay)}>
                                <Plus size={12} /> Add snack
                              </button>
                            ) : (
                              <button className="btn btn-outline btn-xs flex-1 gap-1" onClick={() => setAddMealForSlot({ date: selectedDay, slot })}>
                                <Plus size={12} /> Add meal
                              </button>
                            )}
                            <button className="btn btn-outline btn-xs gap-1 text-accent border-accent/30" onClick={() => setTryPickerFor({ date: selectedDay, slot })}>
                              <Sparkle size={12} /> Try
                            </button>
                          </div>
                        </div>
                        )
                      })}
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

      {/* ── Meals to try ─────────────────────────────────────────── */}
      {subTab === 'to-try' && (
        <MealsToTrySection
          mealsToTry={mealsToTry}
          ingredientMap={ingredientMap}
          onAdd={() => { setEditToTry(undefined); setShowToTryForm(true) }}
          onEdit={(m) => { setEditToTry(m); setShowToTryForm(true) }}
          onDelete={deleteMealToTry}
          onMarkTried={(m) => setConvertToTry(m)}
        />
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

      {/* Meal-to-try form modal */}
      {showToTryForm && (
        <MealToTryForm
          item={editToTry}
          onSave={async (data) => {
            if (editToTry?.id != null) await updateMealToTry(editToTry.id, data)
            else await addMealToTry({ ...data, tried: false })
          }}
          onClose={() => { setShowToTryForm(false); setEditToTry(undefined) }}
        />
      )}

      {/* Convert meal-to-try → real meal (pre-filled MealForm) */}
      {convertToTry && (
        <MealForm
          meal={{ name: convertToTry.title, ingredients: convertToTry.ingredients, notes: convertToTry.notes, cookingTime: convertToTry.cookingTime, isVegetarian: convertToTry.isVegetarian, createdAt: new Date() }}
          onSave={async (data) => {
            await addMeal(data)
            await markTried(convertToTry.id!)
            setConvertToTry(undefined)
          }}
          onClose={() => setConvertToTry(undefined)}
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

      {/* Snack ingredient picker modal */}
      {addSnackIngForDate && (
        <SnackIngredientModal
          ingredients={ingredients}
          existingMealIds={plan?.days.find(d => d.date === addSnackIngForDate)?.snackIngredientIds ?? []}
          meals={meals}
          plannedMealIds={plan?.days.find(d => d.date === addSnackIngForDate)?.slots.snack ?? []}
          onAddIngredient={async (ingId) => {
            await addSnackIngredient(addSnackIngForDate, ingId)
            setAddSnackIngForDate(null)
          }}
          onAddMeal={async (mealId) => {
            await addMealToDay(addSnackIngForDate, 'snack', mealId)
            setAddSnackIngForDate(null)
          }}
          onClose={() => setAddSnackIngForDate(null)}
        />
      )}

      {/* Try-meal picker for planner slots */}
      {tryPickerFor && (
        <TryMealPickerModal
          mealsToTry={mealsToTry}
          plannedIds={plan?.days.find(d => d.date === tryPickerFor.date)?.tryMealSlots?.[tryPickerFor.slot] ?? []}
          onAdd={async (id) => {
            await addTryMealToSlot(tryPickerFor.date, tryPickerFor.slot, id)
            setTryPickerFor(null)
          }}
          onClose={() => setTryPickerFor(null)}
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
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="card-title text-base leading-snug">{meal.name}</h3>
            {meal.isVegetarian && <span className="text-sm" title="Vegetarian">🌿</span>}
          </div>
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

function DroppableSlot({ date, slot, mealIds, snackIngredientIds, tryMealIds, mealMap, ingredientMap, mealToTryMap, isEatingOut, onRemoveMeal, onClickAdd, onRemoveSnackIngredient, onClickTry, onRemoveTryMeal, onToggleEatingOut }: {
  date: string; slot: MealSlot; mealIds: number[]; snackIngredientIds?: number[]; tryMealIds?: number[]
  mealMap: Map<number, Meal>; ingredientMap: Map<number, Ingredient>; mealToTryMap: Map<number, MealToTry>
  isEatingOut: boolean; onRemoveMeal: (id: number) => void; onClickAdd: () => void
  onRemoveSnackIngredient?: (id: number) => void; onClickTry: () => void; onRemoveTryMeal: (id: number) => void; onToggleEatingOut: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${date}-${slot}` })
  const abbrev: Record<MealSlot, string> = { breakfast: 'Bkfst', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
  return (
    <div ref={setNodeRef} className={`flex flex-col p-1 min-h-[52px] transition-colors border-b border-base-200 last:border-b-0 ${isOver ? 'bg-primary/10' : ''}`}>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[9px] text-base-content/30 font-semibold uppercase tracking-wide flex items-center gap-0.5">
          {abbrev[slot]}{isEatingOut && <ForkKnife size={8} className="text-secondary" weight="fill" />}
        </p>
        <button className={`transition-colors ${isEatingOut ? 'text-secondary' : 'text-base-content/15 hover:text-base-content/40'}`} onClick={onToggleEatingOut} title={isEatingOut ? 'Eating out — click to undo' : 'Mark as eating out'}>
          <ForkKnife size={9} weight={isEatingOut ? 'fill' : 'regular'} />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        {mealIds.map(id => (
          <div key={id} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs flex items-center gap-1 group">
            <span className="flex-1 truncate">{mealMap.get(id)?.name ?? '—'}</span>
            <button className="opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-error transition-opacity" onClick={() => onRemoveMeal(id)}><X size={10} /></button>
          </div>
        ))}
        {(tryMealIds ?? []).map(id => (
          <div key={id} className="bg-accent/15 text-accent-content rounded px-1.5 py-0.5 text-xs flex items-center gap-0.5 group">
            <Sparkle size={8} className="text-accent flex-shrink-0" weight="fill" />
            <span className="flex-1 truncate">{mealToTryMap.get(id)?.title ?? '—'}</span>
            <button className="opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-error transition-opacity" onClick={() => onRemoveTryMeal(id)}><X size={10} /></button>
          </div>
        ))}
        {slot === 'snack' && (snackIngredientIds ?? []).map(ingId => (
          <div key={ingId} className="bg-success/10 text-success rounded px-1.5 py-0.5 text-xs flex items-center gap-1 group">
            <span className="flex-1 truncate">{ingredientMap.get(ingId)?.name ?? '—'}</span>
            <button className="opacity-0 group-hover:opacity-100 text-base-content/50 hover:text-error transition-opacity" onClick={() => onRemoveSnackIngredient?.(ingId)}><X size={10} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-0.5 mt-0.5">
        <button className="text-base-content/20 hover:text-base-content/50 transition-colors flex-1 flex items-center justify-center" onClick={onClickAdd}><Plus size={11} /></button>
        <button className="text-accent/30 hover:text-accent transition-colors" onClick={onClickTry} title="Schedule a meal to try"><Sparkle size={10} /></button>
      </div>
    </div>
  )
}

function DroppableDay({ date, day, dayName, mealMap, ingredientMap, mealToTryMap, onRemoveMeal, onClickAdd, onToggleSlotEatingOut, onToggleHighEnergy, onRemoveSnackIngredient, onClickTry, onRemoveTryMeal }: {
  date: string; day: MealPlanDay; dayName: string
  mealMap: Map<number, Meal>; ingredientMap: Map<number, Ingredient>; mealToTryMap: Map<number, MealToTry>
  onRemoveMeal: (slot: MealSlot, mealId: number) => void; onClickAdd: (slot: MealSlot) => void
  onToggleSlotEatingOut: (slot: MealSlot) => void; onToggleHighEnergy: () => void
  onRemoveSnackIngredient: (ingId: number) => void; onClickTry: (slot: MealSlot) => void; onRemoveTryMeal: (slot: MealSlot, id: number) => void
}) {
  const dateNum = date.split('-')[2]
  return (
    <div className={`flex flex-col rounded-lg border overflow-hidden ${day.highEnergy ? 'border-warning/60' : 'border-base-300'}`}>
      <div className={`text-center py-1.5 border-b flex items-center justify-center gap-1 ${day.highEnergy ? 'bg-warning/20 border-warning/40' : 'bg-base-200 border-base-300'}`}>
        <div>
          <p className="text-xs font-semibold text-base-content/50">{dayName}</p>
          <p className="text-sm font-bold">{dateNum}</p>
        </div>
        {day.highEnergy && <Lightning size={11} className="text-warning" weight="fill" />}
      </div>
      <div className="flex flex-col flex-1">
        {MEAL_SLOTS.map(slot => (
          <DroppableSlot
            key={slot} date={date} slot={slot}
            mealIds={day.slots[slot]}
            snackIngredientIds={slot === 'snack' ? day.snackIngredientIds : undefined}
            tryMealIds={day.tryMealSlots?.[slot]}
            mealMap={mealMap} ingredientMap={ingredientMap} mealToTryMap={mealToTryMap}
            isEatingOut={day.eatingOutSlots?.[slot] ?? false}
            onRemoveMeal={(mealId) => onRemoveMeal(slot, mealId)}
            onClickAdd={() => onClickAdd(slot)}
            onToggleEatingOut={() => onToggleSlotEatingOut(slot)}
            onRemoveSnackIngredient={onRemoveSnackIngredient}
            onClickTry={() => onClickTry(slot)}
            onRemoveTryMeal={(id) => onRemoveTryMeal(slot, id)}
          />
        ))}
      </div>
      <button
        className={`text-[8px] py-0.5 border-t flex items-center justify-center gap-0.5 transition-colors ${day.highEnergy ? 'text-warning border-warning/30 hover:text-warning/60' : 'text-base-content/25 border-base-200 hover:text-warning'}`}
        onClick={onToggleHighEnergy}
        title={day.highEnergy ? 'Unmark high energy day' : 'Mark as high energy day'}
      >
        <Lightning size={8} weight={day.highEnergy ? 'fill' : 'regular'} /> ⚡
      </button>
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
  const [timeFilter, setTimeFilter] = useState<string>('all')
  const [veggieOnly, setVeggieOnly] = useState(false)
  const planned = new Set(plannedMealIds)
  const filtered = meals.filter(m => {
    if (planned.has(m.id!)) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    if (timeFilter !== 'all' && m.cookingTime !== timeFilter) return false
    if (veggieOnly && !m.isVegetarian) return false
    return true
  })

  const timeOptions = [
    { value: 'all', label: 'Any time' },
    { value: 'very-quick', label: '< 15 min' },
    { value: 'quick', label: '< 30 min' },
    { value: 'medium', label: '30–60 min' },
    { value: 'decadent', label: '1 hr+' },
  ]

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg mb-0.5">Add meal</h3>
        <p className="text-sm text-base-content/50 mb-3">{MEAL_SLOT_LABELS[slot]}</p>
        <label className="input input-bordered input-sm flex items-center gap-2 mb-2">
          <input
            className="grow"
            placeholder="Search meals…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </label>
        <div className="flex flex-wrap gap-1 mb-2">
          {timeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`badge cursor-pointer select-none ${timeFilter === opt.value ? 'badge-primary' : 'badge-ghost'}`}
              onClick={() => setTimeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <label className={`badge cursor-pointer select-none ml-auto ${veggieOnly ? 'badge-success' : 'badge-ghost'}`}>
            <input type="checkbox" className="hidden" checked={veggieOnly} onChange={e => setVeggieOnly(e.target.checked)} />
            🌿 Veggie
          </label>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-base-content/40 py-4 text-center">
            {meals.length === 0 ? 'No meals saved — create some in the Meals tab first' : 'No meals match these filters'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {filtered.map(meal => (
              <li key={meal.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm flex items-center justify-between gap-2"
                  onClick={() => onAdd(meal.id!)}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    {meal.isVegetarian && <span>🌿</span>}
                    <span className="truncate">{meal.name}</span>
                  </span>
                  {meal.cookingTime && (
                    <span className={`badge badge-xs flex-shrink-0 ${COOKING_TIME_BADGE[meal.cookingTime]}`}>
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

function SnackIngredientModal({ ingredients, existingMealIds, meals, plannedMealIds, onAddIngredient, onAddMeal, onClose }: {
  ingredients: Ingredient[]
  existingMealIds: number[]
  meals: Meal[]
  plannedMealIds: number[]
  onAddIngredient: (id: number) => Promise<void>
  onAddMeal: (id: number) => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'ingredient' | 'meal'>('ingredient')
  const [search, setSearch] = useState('')
  const existingIngIds = new Set(existingMealIds)
  const plannedSet = new Set(plannedMealIds)

  const filteredIngredients = ingredients.filter(i =>
    !existingIngIds.has(i.id!) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredMeals = meals.filter(m =>
    !plannedSet.has(m.id!) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg mb-3">Add to Snack</h3>
        <div role="tablist" className="tabs tabs-bordered mb-3">
          <button role="tab" className={`tab tab-sm ${tab === 'ingredient' ? 'tab-active' : ''}`} onClick={() => setTab('ingredient')}>
            Ingredient
          </button>
          <button role="tab" className={`tab tab-sm ${tab === 'meal' ? 'tab-active' : ''}`} onClick={() => setTab('meal')}>
            Meal
          </button>
        </div>
        <label className="input input-bordered input-sm flex items-center gap-2 mb-2">
          <input
            className="grow"
            placeholder={tab === 'ingredient' ? 'Search ingredients…' : 'Search meals…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </label>
        {tab === 'ingredient' ? (
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filteredIngredients.length === 0 ? (
              <p className="text-sm text-base-content/40 py-4 text-center">No ingredients found</p>
            ) : filteredIngredients.map(i => (
              <li key={i.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm"
                  onClick={() => onAddIngredient(i.id!)}
                >
                  {i.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filteredMeals.length === 0 ? (
              <p className="text-sm text-base-content/40 py-4 text-center">No meals found</p>
            ) : filteredMeals.map(m => (
              <li key={m.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm flex items-center justify-between gap-2"
                  onClick={() => onAddMeal(m.id!)}
                >
                  <span className="flex items-center gap-1">{m.isVegetarian && <span>🌿</span>}{m.name}</span>
                  {m.cookingTime && <span className={`badge badge-xs ${COOKING_TIME_BADGE[m.cookingTime]}`}>{COOKING_TIME_LABELS[m.cookingTime]}</span>}
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

// ── Meals to try section ─────────────────────────────────────────────────────

function MealsToTrySection({ mealsToTry, ingredientMap, onAdd, onEdit, onDelete, onMarkTried }: {
  mealsToTry: MealToTry[]
  ingredientMap: Map<number, Ingredient>
  onAdd: () => void
  onEdit: (m: MealToTry) => void
  onDelete: (id: number) => Promise<void>
  onMarkTried: (m: MealToTry) => void
}) {
  const pending = mealsToTry.filter(m => !m.tried)
  const tried = mealsToTry.filter(m => m.tried)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Meals to try</h1>
          <p className="text-sm text-base-content/50 mt-0.5">Collect recipes you want to make. Convert them to real meals when you've tried them.</p>
        </div>
        <button className="btn btn-accent btn-sm gap-1" onClick={onAdd}>
          <Plus size={15} weight="bold" /> Add recipe
        </button>
      </div>

      {mealsToTry.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <Sparkle size={48} weight="thin" className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nothing saved yet</p>
          <p className="text-sm mt-1">Save recipes, URLs and ideas here to try later</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {pending.map(m => (
                <MealToTryCard key={m.id} item={m} ingredientMap={ingredientMap} onEdit={onEdit} onDelete={onDelete} onMarkTried={onMarkTried} />
              ))}
            </div>
          )}
          {tried.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-3">Already tried ({tried.length})</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {tried.map(m => (
                  <MealToTryCard key={m.id} item={m} ingredientMap={ingredientMap} onEdit={onEdit} onDelete={onDelete} onMarkTried={onMarkTried} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MealToTryCard({ item, ingredientMap, onEdit, onDelete, onMarkTried }: {
  item: MealToTry
  ingredientMap: Map<number, Ingredient>
  onEdit: (m: MealToTry) => void
  onDelete: (id: number) => Promise<void>
  onMarkTried: (m: MealToTry) => void
}) {
  return (
    <div className={`card shadow-sm border transition-all ${item.tried ? 'bg-base-200 border-base-300' : 'bg-base-100 border-accent/20 hover:shadow-md'}`}>
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.tried && <CheckCircle size={15} className="text-success flex-shrink-0" weight="fill" />}
            <h3 className={`font-bold text-base leading-snug truncate ${item.tried ? 'line-through text-base-content/50' : ''}`}>{item.title}</h3>
            {item.isVegetarian && <span className="flex-shrink-0">🌿</span>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button className="btn btn-ghost btn-xs" onClick={() => onEdit(item)}><PencilSimple size={14} /></button>
            <button className="btn btn-ghost btn-xs text-error opacity-50 hover:opacity-100" onClick={() => onDelete(item.id!)}><Trash size={14} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.cookingTime && (
            <span className={`badge badge-sm ${COOKING_TIME_BADGE[item.cookingTime]}`}>{COOKING_TIME_LABELS[item.cookingTime]}</span>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/70 truncate max-w-[180px]">
              <Link size={11} /> <span className="truncate">{new URL(item.url).hostname.replace('www.', '')}</span>
            </a>
          )}
        </div>

        {item.notes && <p className="text-sm text-base-content/60 line-clamp-2 mt-1">{item.notes}</p>}

        {item.ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.ingredients.slice(0, 5).map(({ ingredientId, role }) => {
              const ing = ingredientMap.get(ingredientId)
              if (!ing) return null
              const roleClass = role && role !== 'core' ? INGREDIENT_ROLE_BADGE_DISPLAY[role] : 'badge-ghost'
              return <span key={ingredientId} className={`badge badge-sm ${roleClass}`}>{ing.name}</span>
            })}
            {item.ingredients.length > 5 && <span className="badge badge-ghost badge-sm">+{item.ingredients.length - 5}</span>}
          </div>
        )}

        {!item.tried && (
          <div className="mt-3 pt-3 border-t border-base-200">
            <button className="btn btn-success btn-sm btn-outline w-full gap-1.5" onClick={() => onMarkTried(item)}>
              <CheckCircle size={14} weight="bold" /> Meal tried! → Add to my meals
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TryMealPickerModal({ mealsToTry, plannedIds, onAdd, onClose }: {
  mealsToTry: MealToTry[]
  plannedIds: number[]
  onAdd: (id: number) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const planned = new Set(plannedIds)
  const filtered = mealsToTry.filter(m =>
    !m.tried && !planned.has(m.id!) &&
    (!search || m.title.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg mb-0.5 flex items-center gap-2">
          <Sparkle size={18} className="text-accent" weight="fill" /> Schedule a meal to try
        </h3>
        <p className="text-sm text-base-content/50 mb-3">Pick from your saved recipes</p>
        <label className="input input-bordered input-sm flex items-center gap-2 mb-3">
          <input className="grow" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </label>
        {filtered.length === 0 ? (
          <p className="text-sm text-base-content/40 py-4 text-center">
            {mealsToTry.filter(m => !m.tried).length === 0 ? 'No meals to try saved yet — add some in the Meals to try tab' : 'Nothing matches'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {filtered.map(m => (
              <li key={m.id}>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm flex items-center justify-between gap-2" onClick={() => onAdd(m.id!)}>
                  <span className="flex items-center gap-1 min-w-0">
                    {m.isVegetarian && <span>🌿</span>}
                    <span className="truncate">{m.title}</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {m.cookingTime && <span className={`badge badge-xs ${COOKING_TIME_BADGE[m.cookingTime]}`}>{COOKING_TIME_LABELS[m.cookingTime]}</span>}
                    {m.url && <Link size={11} className="text-secondary" />}
                  </div>
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
