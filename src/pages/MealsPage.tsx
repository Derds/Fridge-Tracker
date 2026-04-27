import React, { useEffect, useMemo, useState } from 'react'
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
import { useRecipeBlogStore } from '../store/recipeBlogStore'
import { useMealTrackerStore } from '../store/mealTrackerStore'
import { getWeekDays as getTrackerWeekDays } from '../store/mealTrackerStore'
import { MealForm } from '../components/MealForm'
import { MealToTryForm } from '../components/MealToTryForm'
import type { Ingredient, Meal, MealPlanDay, MealSlot, MealToTry, TrackedSlot } from '../types'
import {
  MEAL_SLOTS, MEAL_SLOT_LABELS,
  COOKING_TIME_LABELS, COOKING_TIME_BADGE,
  INGREDIENT_ROLE_BADGE_DISPLAY,
} from '../types'
import { ForkKnife, Plus, PencilSimple, Trash, X, ArrowLeft, ArrowRight, ShoppingCart, ChartBar, ArrowSquareOut, UploadSimple, Sparkle, Lightning, Link, CheckCircle, ClipboardText, Prohibit, WarningCircle, SmileyWink, Download, Upload, ArrowsClockwise } from '@phosphor-icons/react'
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
  const [subTab, setSubTab] = useState<'gallery' | 'planner' | 'to-try' | 'tracker'>('planner')
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
  // Tracker state
  const [trackerWeekStart, setTrackerWeekStart] = useState<string>(() => getMonday())
  const [trackerImportMsg, setTrackerImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { meals, loadMeals, addMeal, updateMeal, deleteMeal } = useMealStore()
  const { plan, weekStart, loading: planLoading, loadWeek, addMealToDay, removeMealFromDay, toggleSlotEatingOut, toggleHighEnergy, addSnackIngredient, removeSnackIngredient, addTryMealToSlot, removeTryMealFromSlot } = useWeekPlannerStore()
  const { ingredients, loadIngredients } = useIngredientStore()
  const { items: inventory, loadInventory } = useInventoryStore()
  const { loadOrCreateList, bulkAddToActual } = useShoppingStore()
  const { mealsToTry, loadMealsToTry, addMealToTry, updateMealToTry, deleteMealToTry, markTried } = useMealToTryStore()
  const { tracker, loadWeek: loadTrackerWeek, initFromPlan, syncFromPlan, updateSlot, clearWeek, exportCSV, importCSV } = useMealTrackerStore()

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
    loadTrackerWeek(trackerWeekStart)
  }, [trackerWeekStart, loadTrackerWeek])

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
        <button
          className={`btn join-item gap-1.5 ${subTab === 'tracker' ? 'btn-secondary' : 'btn-ghost border border-base-300'}`}
          onClick={() => setSubTab('tracker')}
        >
          <ClipboardText size={14} weight={subTab === 'tracker' ? 'fill' : 'regular'} />
          Tracker
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
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <MealsToTrySection
              mealsToTry={mealsToTry}
              ingredientMap={ingredientMap}
              onAdd={() => { setEditToTry(undefined); setShowToTryForm(true) }}
              onEdit={(m) => { setEditToTry(m); setShowToTryForm(true) }}
              onDelete={deleteMealToTry}
              onMarkTried={(m) => setConvertToTry(m)}
            />
          </div>
          <RecipeBlogPanel />
        </div>
      )}

      {subTab === 'tracker' && (
        <MealTrackerView
          trackerWeekStart={trackerWeekStart}
          tracker={tracker}
          meals={meals}
          mealMap={mealMap}
          ingredientMap={ingredientMap}
          planForWeek={plan?.weekStartDate === trackerWeekStart ? plan : null}
          onNavWeek={(offset) => {
            const [y, m, d] = trackerWeekStart.split('-').map(Number)
            const base = new Date(y, m - 1, d + offset)
            setTrackerWeekStart(getMonday(base))
          }}
          onInitFromPlan={async () => {
            if (plan?.weekStartDate === trackerWeekStart && plan.days.length > 0) {
              await initFromPlan(trackerWeekStart, plan.days)
            }
          }}
          onSyncFromPlan={async () => {
            if (plan?.weekStartDate === trackerWeekStart && plan.days.length > 0) {
              await syncFromPlan(plan.days)
            }
          }}
          onUpdateSlot={updateSlot}
          onClear={() => clearWeek(trackerWeekStart)}
          onExportCSV={() => exportCSV(new Map(meals.map(m => [m.id!, m.name])))}
          onImportCSV={async (csv) => {
            const mealMap = new Map(meals.map(m => [m.name.toLowerCase(), m.id!]))
            const result = await importCSV(csv, mealMap)
            setTrackerImportMsg({
              ok: result.errors.length === 0,
              text: result.errors.length === 0
                ? `Imported ${result.imported} week(s) successfully`
                : `Imported ${result.imported} week(s) with ${result.errors.length} errors: ${result.errors.slice(0, 2).join('; ')}`
            })
            loadTrackerWeek(trackerWeekStart)
            setTimeout(() => setTrackerImportMsg(null), 5000)
          }}
          importMsg={trackerImportMsg}
        />
      )}


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
          meal={{ name: convertToTry.title, url: convertToTry.url, ingredients: convertToTry.ingredients, notes: convertToTry.notes, cookingTime: convertToTry.cookingTime, isVegetarian: convertToTry.isVegetarian, createdAt: new Date() }}
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
        {meal.suitableFor && meal.suitableFor.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {meal.suitableFor.map(s => (
              <span key={s} className="badge badge-outline badge-xs text-base-content/50">{MEAL_SLOT_LABELS[s]}</span>
            ))}
          </div>
        )}
        {meal.url && (
          <a href={meal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/70 mt-1 truncate">
            <Link size={11} /> <span className="truncate">{new URL(meal.url).hostname.replace('www.', '')}</span>
          </a>
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
  const [showAll, setShowAll] = useState(false)
  const planned = new Set(plannedMealIds)

  // Split into slot-relevant and others
  const base = meals.filter(m => {
    if (planned.has(m.id!)) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    if (timeFilter !== 'all' && m.cookingTime !== timeFilter) return false
    if (veggieOnly && !m.isVegetarian) return false
    return true
  })
  const relevant = base.filter(m => !m.suitableFor?.length || m.suitableFor.includes(slot))
  const others = base.filter(m => m.suitableFor?.length && !m.suitableFor.includes(slot))

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
        {base.length === 0 ? (
          <p className="text-sm text-base-content/40 py-4 text-center">
            {meals.length === 0 ? 'No meals saved — create some in the Meals tab first' : 'No meals match these filters'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {relevant.map(meal => (
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
            {others.length > 0 && !showAll && (
              <li>
                <button className="w-full text-center text-xs text-base-content/40 py-1.5 hover:text-base-content/70" onClick={() => setShowAll(true)}>
                  + {others.length} more (not tagged for {MEAL_SLOT_LABELS[slot]})
                </button>
              </li>
            )}
            {showAll && others.map(meal => (
              <li key={meal.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 text-sm flex items-center justify-between gap-2 opacity-60"
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

// ── Meal Tracker ─────────────────────────────────────────────────────────────

const DAY_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MealTrackerView({
  trackerWeekStart, tracker, meals, mealMap, ingredientMap, planForWeek,
  onNavWeek, onInitFromPlan, onSyncFromPlan, onUpdateSlot, onClear, onExportCSV, onImportCSV, importMsg
}: {
  trackerWeekStart: string
  tracker: ReturnType<typeof useMealTrackerStore.getState>['tracker']
  meals: Meal[]
  mealMap: Map<number, Meal>
  ingredientMap: Map<number, Ingredient>
  planForWeek: { days: MealPlanDay[] } | null
  onNavWeek: (offset: number) => void
  onInitFromPlan: () => Promise<void>
  onSyncFromPlan: () => Promise<void>
  onUpdateSlot: (date: string, slot: MealSlot, patch: Partial<TrackedSlot>) => Promise<void>
  onClear: () => Promise<void>
  onExportCSV: () => void
  onImportCSV: (csv: string) => Promise<void>
  importMsg: { ok: boolean; text: string } | null
}) {
  const weekDays = getTrackerWeekDays(trackerWeekStart)
  const [replaceFor, setReplaceFor] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const importRef = React.useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  // Week is current or future if its last day (Sunday) >= today
  const weekEndDate = weekDays[weekDays.length - 1]
  const isCurrentOrFutureWeek = weekEndDate >= today

  // Default breakfast — stored in localStorage
  type DefaultBreakfast = { mealId?: number; name?: string }
  const [defaultBreakfast, setDefaultBreakfastState] = useState<DefaultBreakfast>(() => {
    try { return JSON.parse(localStorage.getItem('tracker-default-breakfast') ?? 'null') ?? {} } catch { return {} }
  })
  const [showBreakfastSettings, setShowBreakfastSettings] = useState(false)
  const [bkfstSearch, setBkfstSearch] = useState('')
  const [bkfstFreeText, setBkfstFreeText] = useState(defaultBreakfast.name ?? '')

  function saveDefaultBreakfast(val: DefaultBreakfast) {
    localStorage.setItem('tracker-default-breakfast', JSON.stringify(val))
    setDefaultBreakfastState(val)
  }

  const defaultBreakfastName = defaultBreakfast.mealId
    ? (mealMap.get(defaultBreakfast.mealId)?.name ?? null)
    : (defaultBreakfast.name ?? null)

  // Meals suitable for breakfast (or with no suitableFor set)
  const breakfastMeals = meals.filter(m => !m.suitableFor?.length || m.suitableFor.includes('breakfast'))
  const bkfstResults = breakfastMeals.filter(m => bkfstSearch && m.name.toLowerCase().includes(bkfstSearch.toLowerCase())).slice(0, 6)

  const weekLabel = (() => {
    const [y, m, d] = trackerWeekStart.split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + 6)
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
  })()

  const hasPlan = (planForWeek?.days ?? []).some(d => MEAL_SLOTS.some(s => (d.slots[s]?.length ?? 0) > 0))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardText size={22} className="text-secondary" weight="fill" /> Meal Tracker</h1>
          <p className="text-sm text-base-content/50 mt-0.5">Log what you actually ate — based on your week plan</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {tracker && (
            <>
              {hasPlan && isCurrentOrFutureWeek && (
                <button
                  className="btn btn-secondary btn-sm btn-outline gap-1.5"
                  disabled={syncing}
                  onClick={async () => { setSyncing(true); await onSyncFromPlan(); setSyncing(false) }}
                  title="Update planned meals from your week plan — won't overwrite slots you've already tracked"
                >
                  <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : ''} /> Sync from plan
                </button>
              )}
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={onExportCSV}><Download size={14} /> Export CSV</button>
              <button className="btn btn-error btn-sm btn-outline gap-1" onClick={() => { if (confirm('Clear all tracking data for this week?')) onClear() }}><Trash size={14} /> Clear week</button>
            </>
          )}
          <label className="btn btn-ghost btn-sm gap-1.5 cursor-pointer">
            <Upload size={14} /> Import CSV
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              await onImportCSV(text)
              if (importRef.current) importRef.current.value = ''
            }} />
          </label>
        </div>
      </div>

      {importMsg && (
        <div className={`alert ${importMsg.ok ? 'alert-success' : 'alert-warning'} mb-4 py-2 text-sm`}>{importMsg.text}</div>
      )}

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button className="btn btn-ghost btn-sm" onClick={() => onNavWeek(-7)}><ArrowLeft size={14} /></button>
        <span className="font-semibold text-sm">{weekLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavWeek(7)}><ArrowRight size={14} /></button>
      </div>

      {/* No tracker yet — show plan preview or blank state */}
      {!tracker ? (
        <div className="rounded-xl border border-base-300 bg-base-100 p-8 text-center">
          <ClipboardText size={48} weight="thin" className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1">No tracking data for this week</p>
          {hasPlan ? (
            <div>
              <p className="text-sm text-base-content/50 mb-4">You have a meal plan for this week. Initialise the tracker from it, or start blank.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button className="btn btn-secondary gap-1.5" onClick={onInitFromPlan}><ClipboardText size={15} /> Initialise from plan</button>
                <button className="btn btn-ghost" onClick={() => onInitFromPlan()}>Start blank</button>
              </div>
              <div className="mt-5 max-w-xl mx-auto text-left">
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-2">Plan preview</p>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {weekDays.map((date, i) => {
                    const day = planForWeek?.days.find(d => d.date === date)
                    return (
                      <div key={date} className="bg-base-200 rounded p-1.5">
                        <p className="font-bold text-[9px] text-base-content/40 uppercase mb-1">{DAY_ABBREV[i]}</p>
                        {MEAL_SLOTS.map(slot => {
                          const ids = day?.slots[slot] ?? []
                          return ids.length > 0 ? (
                            <p key={slot} className="text-[9px] text-primary truncate">{mealMap.get(ids[0])?.name ?? '?'}</p>
                          ) : null
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-base-content/50 mb-4">No meal plan for this week either. Start a blank tracker or plan your week first.</p>
              <button className="btn btn-secondary gap-1.5" onClick={onInitFromPlan}><ClipboardText size={15} /> Start blank tracker</button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Default breakfast settings bar */}
          <div className="mb-4 rounded-lg border border-base-200 bg-base-100">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-base-200 rounded-lg transition-colors"
              onClick={() => setShowBreakfastSettings(v => !v)}
            >
              <span className="flex items-center gap-2 font-medium text-base-content/70">
                <span>🥣</span> Default breakfast
                {defaultBreakfastName
                  ? <span className="text-primary font-semibold ml-1">{defaultBreakfastName}</span>
                  : <span className="text-base-content/40 font-normal">not set — breakfast slots will be blank</span>
                }
              </span>
              <span className="text-base-content/30 text-xs">{showBreakfastSettings ? '▲' : '▼'}</span>
            </button>

            {showBreakfastSettings && (
              <div className="px-4 pb-4 border-t border-base-200 pt-3">
                <p className="text-xs text-base-content/50 mb-3">Choose a default meal that will pre-fill all breakfast slots with no meal assigned. You can still edit individual days.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-base-content/50 mb-1.5">Search your meals</p>
                    <input
                      className="input input-bordered input-sm w-full mb-1.5"
                      placeholder="Search meals…"
                      value={bkfstSearch}
                      onChange={e => setBkfstSearch(e.target.value)}
                    />
                    {bkfstResults.length > 0 && (
                      <ul className="border border-base-300 rounded-lg overflow-hidden">
                        {bkfstResults.map(m => (
                          <li key={m.id}>
                            <button className="w-full text-left px-3 py-1.5 hover:bg-base-200 text-sm" onClick={() => { saveDefaultBreakfast({ mealId: m.id }); setBkfstSearch(''); setShowBreakfastSettings(false) }}>
                              {m.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-base-content/50 mb-1.5">Or set free text</p>
                    <div className="flex gap-1.5">
                      <input
                        className="input input-bordered input-sm flex-1"
                        placeholder="e.g. Porridge, Toast…"
                        value={bkfstFreeText}
                        onChange={e => setBkfstFreeText(e.target.value)}
                      />
                      <button className="btn btn-secondary btn-sm" disabled={!bkfstFreeText.trim()} onClick={() => { saveDefaultBreakfast({ name: bkfstFreeText.trim() }); setShowBreakfastSettings(false) }}>Set</button>
                    </div>
                  </div>
                </div>
                {defaultBreakfastName && (
                  <button className="btn btn-ghost btn-xs text-error mt-3" onClick={() => { saveDefaultBreakfast({}); setShowBreakfastSettings(false) }}>
                    <X size={12} /> Clear default
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tracker grid */}
          <div className="overflow-x-auto">
            <div className="grid gap-2 min-w-[700px]" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
              {/* Header row */}
              <div />
              {weekDays.map((date, i) => (
                <div key={date} className={`text-center py-1 rounded ${date === today ? 'bg-primary/10' : ''}`}>
                  <p className="text-xs font-bold text-base-content/50 uppercase">{DAY_ABBREV[i]}</p>
                  <p className="text-sm font-bold">{date.split('-')[2]}</p>
                  {date === today && <p className="text-[9px] text-primary font-semibold uppercase tracking-wide">Today</p>}
                </div>
              ))}

              {/* Slot rows */}
              {MEAL_SLOTS.map(slot => (
                <React.Fragment key={slot}>
                  <div className="flex items-center">
                    <span className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">{MEAL_SLOT_LABELS[slot]}</span>
                  </div>
                  {weekDays.map(date => {
                    const trackedDay = tracker.days.find(d => d.date === date)
                    const s = trackedDay?.slots[slot]
                    const isPast = date < today
                    const hasContent = s?.plannedMealId || s?.actualMealId || s?.actualMealName || s?.skipped || s?.eatingOut
                    const isAssumedSkipped = isPast && !hasContent

                    // Resolve display: actual > planned > default breakfast
                    const displayMeal = s?.actualMealId ? mealMap.get(s.actualMealId) : s?.plannedMealId ? mealMap.get(s.plannedMealId) : null
                    const defaultBkfstMeal = slot === 'breakfast' ? (defaultBreakfast.mealId ? mealMap.get(defaultBreakfast.mealId) : null) : null
                    const defaultBkfstName = slot === 'breakfast' ? (defaultBkfstMeal?.name ?? defaultBreakfast.name ?? null) : null
                    const displayName = s?.actualMealName ?? displayMeal?.name ?? defaultBkfstName
                    const isActualDiff = s?.actualMealId != null || s?.actualMealName != null
                    const isDefault = !s?.actualMealId && !s?.actualMealName && !displayMeal && !!defaultBkfstName

                    return (
                      <div key={date} className={`rounded-lg border p-1.5 min-h-[64px] flex flex-col gap-0.5 transition-all
                        ${s?.skipped || isAssumedSkipped
                          ? isAssumedSkipped ? 'bg-base-200/50 border-base-200 opacity-40' : 'bg-base-200 border-base-300 opacity-50'
                          : s?.eatingOut ? 'bg-secondary/5 border-secondary/20'
                          : isDefault ? 'bg-base-100 border-primary/20'
                          : 'bg-base-100 border-base-200 hover:border-base-300'}`}>
                        {isAssumedSkipped ? (
                          <p className="text-[9px] text-base-content/30 italic">assumed skipped</p>
                        ) : (
                          <>
                            {displayName && !s?.skipped && !s?.eatingOut && (
                              <p className={`text-[10px] leading-tight font-medium truncate ${isActualDiff ? 'text-accent' : isDefault ? 'text-base-content/40 italic' : 'text-primary'}`} title={displayName}>
                                {displayName}{isDefault && ' *'}
                              </p>
                            )}
                            {s?.eatingOut && !s?.skipped && (
                              <p className="text-[10px] text-secondary flex items-center gap-0.5"><ForkKnife size={9} weight="fill" /> Ate out</p>
                            )}
                            {s?.skipped && (
                              <p className="text-[10px] text-base-content/40 flex items-center gap-0.5"><Prohibit size={9} /> Skipped</p>
                            )}
                          </>
                        )}
                        {/* Action buttons */}
                        <div className="flex gap-0.5 mt-auto pt-0.5 flex-wrap">
                          <button
                            title={s?.skipped ? 'Undo skip' : isAssumedSkipped ? 'Mark as not skipped' : 'Mark skipped'}
                            className={`btn btn-xs p-0 w-5 h-5 min-h-0 ${s?.skipped ? 'btn-error btn-outline' : isAssumedSkipped ? 'btn-error btn-ghost opacity-40 hover:opacity-70' : 'btn-ghost opacity-30 hover:opacity-70'}`}
                            onClick={() => onUpdateSlot(date, slot, { skipped: !s?.skipped, eatingOut: false })}
                          >
                            <Prohibit size={9} />
                          </button>
                          <button
                            title={s?.eatingOut ? 'Undo eating out' : 'Mark eating out'}
                            className={`btn btn-xs p-0 w-5 h-5 min-h-0 ${s?.eatingOut ? 'btn-secondary btn-outline' : 'btn-ghost opacity-30 hover:opacity-70'}`}
                            onClick={() => onUpdateSlot(date, slot, { eatingOut: !s?.eatingOut, skipped: false })}
                          >
                            <ForkKnife size={9} />
                          </button>
                          <button
                            title="Record what you actually ate"
                            className="btn btn-ghost btn-xs p-0 w-5 h-5 min-h-0 opacity-30 hover:opacity-70"
                            onClick={() => setReplaceFor({ date, slot })}
                          >
                            <PencilSimple size={9} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          {defaultBreakfastName && <p className="text-xs text-base-content/35 mt-1.5">* Default breakfast ({defaultBreakfastName})</p>}

          {/* Replace/actual meal modal */}
          {replaceFor && (
            <ReplaceMealModal
              date={replaceFor.date}
              slot={replaceFor.slot}
              current={tracker.days.find(d => d.date === replaceFor.date)?.slots[replaceFor.slot]}
              meals={meals}
              mealMap={mealMap}
              onSave={async (patch) => { await onUpdateSlot(replaceFor.date, replaceFor.slot, patch); setReplaceFor(null) }}
              onClose={() => setReplaceFor(null)}
            />
          )}

          {/* Feedback panel */}
          <TrackerFeedback tracker={tracker} mealMap={mealMap} ingredientMap={ingredientMap} today={today} />
        </>
      )}
    </div>
  )
}

function ReplaceMealModal({ date, slot, current, meals, mealMap, onSave, onClose }: {
  date: string; slot: MealSlot; current?: TrackedSlot
  meals: Meal[]; mealMap: Map<number, Meal>
  onSave: (patch: Partial<TrackedSlot>) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [freeText, setFreeText] = useState(current?.actualMealName ?? '')
  const [mode, setMode] = useState<'search' | 'freetext'>('search')
  const results = meals.filter(m => search && m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <h3 className="font-bold text-lg mb-1">What did you actually eat?</h3>
        <p className="text-sm text-base-content/50 mb-3">{date} · {MEAL_SLOT_LABELS[slot]}</p>

        {current?.plannedMealId && (
          <div className="mb-3 p-2 rounded-lg bg-base-200 text-sm">
            <span className="text-base-content/50">Planned: </span>
            <span className="font-medium">{mealMap.get(current.plannedMealId)?.name}</span>
          </div>
        )}

        <div className="tabs tabs-bordered mb-3">
          <button className={`tab ${mode === 'search' ? 'tab-active' : ''}`} onClick={() => setMode('search')}>From meals list</button>
          <button className={`tab ${mode === 'freetext' ? 'tab-active' : ''}`} onClick={() => setMode('freetext')}>Free text</button>
        </div>

        {mode === 'search' ? (
          <div>
            <input
              className="input input-bordered w-full input-sm mb-2"
              placeholder="Search meals…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {results.map(m => (
                  <li key={m.id}>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-base-200 rounded-lg text-sm"
                      onClick={() => onSave({ actualMealId: m.id, actualMealName: undefined, skipped: false, eatingOut: false })}
                    >
                      {m.name}
                      {m.cookingTime && <span className={`badge badge-xs ml-1.5 ${COOKING_TIME_BADGE[m.cookingTime]}`}>{COOKING_TIME_LABELS[m.cookingTime]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search && results.length === 0 && (
              <p className="text-sm text-base-content/40 py-3 text-center">No match — try free text instead</p>
            )}
          </div>
        ) : (
          <div>
            <input
              className="input input-bordered w-full input-sm mb-3"
              placeholder="e.g. Leftover pasta, takeaway pizza…"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              autoFocus
            />
            <button
              className="btn btn-secondary btn-sm w-full"
              disabled={!freeText.trim()}
              onClick={() => onSave({ actualMealName: freeText.trim(), actualMealId: undefined, skipped: false, eatingOut: false })}
            >
              Save
            </button>
          </div>
        )}

        <div className="modal-action mt-3">
          {(current?.actualMealId || current?.actualMealName) && (
            <button className="btn btn-ghost btn-sm text-error" onClick={() => onSave({ actualMealId: undefined, actualMealName: undefined })}>Clear actual</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

function TrackerFeedback({ tracker, mealMap, ingredientMap, today }: {
  tracker: NonNullable<ReturnType<typeof useMealTrackerStore.getState>['tracker']>
  mealMap: Map<number, Meal>
  ingredientMap: Map<number, Ingredient>
  today: string
}) {
  const warnings: string[] = []
  const positives: string[] = []

  // Count stats
  let totalSlots = 0, skipped = 0, eatingOut = 0, tracked = 0
  let proteinDays = 0, fibreDays = 0, vegDays = 0, greensDays = 0
  let skippedBreakfasts = 0

  const GREEN_TAGS = new Set(['high-vitamin-c', 'high-calcium', 'high-iron', 'low-calorie'])

  for (const day of tracker.days) {
    let dayHasProtein = false, dayHasFibre = false, dayHasVeg = false, dayHasGreens = false
    const isPast = day.date < today

    for (const slot of MEAL_SLOTS) {
      const s = day.slots[slot]
      const hasContent = s?.plannedMealId || s?.actualMealId || s?.actualMealName || s?.skipped || s?.eatingOut
      const isAssumedSkipped = isPast && !hasContent

      if (!s && !isAssumedSkipped) continue
      totalSlots++
      if (s?.skipped || isAssumedSkipped) { skipped++; if (slot === 'breakfast') skippedBreakfasts++; continue }
      if (s?.eatingOut) { eatingOut++; continue }
      tracked++

      const mealId = s?.actualMealId ?? s?.plannedMealId
      if (!mealId) continue
      const meal = mealMap.get(mealId)
      if (!meal) continue

      for (const { ingredientId } of meal.ingredients) {
        const ing = ingredientMap.get(ingredientId)
        if (!ing) continue
        const tags = new Set(ing.nutritionTags ?? [])
        if (tags.has('high-protein')) dayHasProtein = true
        if (tags.has('high-fibre')) dayHasFibre = true
        if (ing.category === 'veg') { dayHasVeg = true; if ([...tags].some(t => GREEN_TAGS.has(t))) dayHasGreens = true }
      }
    }

    if (dayHasProtein) proteinDays++
    if (dayHasFibre) fibreDays++
    if (dayHasVeg) vegDays++
    if (dayHasGreens) greensDays++
  }

  // Warnings
  if (skipped > 5) warnings.push(`You skipped ${skipped} meal slots this week — that's quite a few. Make sure you're still getting enough energy.`)
  else if (skipped > 2) warnings.push(`${skipped} meals were skipped this week.`)
  if (skippedBreakfasts >= 4) warnings.push('You skipped breakfast most days — breakfast can help with energy and focus.')
  if (eatingOut >= 4) warnings.push(`${eatingOut} meals were eaten out — that can make it harder to track nutrition.`)
  if (vegDays < 4) warnings.push('Fewer than 4 days had vegetables in tracked meals — try to include more veg.')
  if (greensDays < 3) warnings.push('Not many meals included leafy greens or vitamin-rich veg this week.')
  if (fibreDays < 4) warnings.push('Fibre intake looks low — try adding more pulses, whole grains or veg.')

  // Positives
  if (proteinDays >= 6) positives.push('Great protein coverage — most days included a good protein source. 💪')
  else if (proteinDays >= 4) positives.push('Good protein intake across most of the week.')
  if (fibreDays >= 5) positives.push('Excellent fibre intake this week — well done! 🌾')
  if (greensDays >= 5) positives.push('Plenty of greens and vitamin-rich veg in your meals this week. 🥦')
  if (vegDays >= 6) positives.push('Vegetables featured in almost every day — great balance.')
  if (skipped === 0 && tracked > 0) positives.push('No meals skipped this week — consistent eating habits!')
  if (eatingOut === 0 && tracked > 0) positives.push('Cooked at home all week — impressive!')

  if (warnings.length === 0 && positives.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-base-300 bg-base-100 p-5">
      <h2 className="font-bold text-base mb-3 flex items-center gap-2">
        <ChartBar size={17} className="text-secondary" /> Weekly summary
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {positives.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-success uppercase tracking-wide mb-2 flex items-center gap-1">
              <SmileyWink size={13} /> Going well
            </p>
            <ul className="flex flex-col gap-1.5">
              {positives.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-success mt-0.5 flex-shrink-0" weight="fill" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-2 flex items-center gap-1">
              <WarningCircle size={13} /> Worth watching
            </p>
            <ul className="flex flex-col gap-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <WarningCircle size={14} className="text-warning mt-0.5 flex-shrink-0" weight="fill" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recipe blogs side panel ──────────────────────────────────────────────────

function RecipeBlogPanel() {
  const { blogs, addBlog, removeBlog, updateBlog } = useRecipeBlogStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editNotes, setEditNotes] = useState('')

  function handleAdd(ev: React.FormEvent) {
    ev.preventDefault()
    if (!newName.trim() || !newUrl.trim()) return
    addBlog(newName.trim(), newUrl.trim(), newNotes.trim() || undefined)
    setNewName(''); setNewUrl(''); setNewNotes(''); setShowAdd(false)
  }

  function startEdit(b: ReturnType<typeof useRecipeBlogStore.getState>['blogs'][0]) {
    setEditId(b.id); setEditName(b.name); setEditUrl(b.url); setEditNotes(b.notes ?? '')
  }

  function handleEditSave(ev: React.FormEvent) {
    ev.preventDefault()
    if (!editId) return
    updateBlog(editId, { name: editName.trim(), url: editUrl.trim(), notes: editNotes.trim() || undefined })
    setEditId(null)
  }

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block">
      <div className="sticky top-4 rounded-xl border border-accent/20 bg-base-100 shadow-sm overflow-hidden">
        <div className="bg-accent/10 px-4 py-3 flex items-center justify-between border-b border-accent/20">
          <div className="flex items-center gap-2">
            <Link size={16} className="text-accent" weight="fill" />
            <span className="font-bold text-sm text-accent">Recipe blogs</span>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={() => { setShowAdd(v => !v); setEditId(null) }}>
            <Plus size={14} weight="bold" />
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="px-3 py-3 border-b border-base-200 flex flex-col gap-2 bg-base-50">
            <input className="input input-bordered input-xs w-full" placeholder="Site name (e.g. Ottolenghi)" value={newName} onChange={e => setNewName(e.target.value)} autoFocus required />
            <input className="input input-bordered input-xs w-full" type="url" placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)} required />
            <input className="input input-bordered input-xs w-full" placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
            <div className="flex gap-1 justify-end">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent btn-xs">Add</button>
            </div>
          </form>
        )}

        {blogs.length === 0 && !showAdd ? (
          <p className="text-xs text-base-content/40 text-center px-4 py-6">Save your favourite recipe blogs and sites here</p>
        ) : (
          <ul className="divide-y divide-base-200">
            {blogs.map(b => (
              <li key={b.id} className="px-3 py-2.5">
                {editId === b.id ? (
                  <form onSubmit={handleEditSave} className="flex flex-col gap-1.5">
                    <input className="input input-bordered input-xs w-full" value={editName} onChange={e => setEditName(e.target.value)} required />
                    <input className="input input-bordered input-xs w-full" type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)} required />
                    <input className="input input-bordered input-xs w-full" placeholder="Notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                    <div className="flex gap-1 justify-end">
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>Cancel</button>
                      <button type="submit" className="btn btn-accent btn-xs">Save</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start gap-1.5 group">
                    <div className="flex-1 min-w-0">
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-secondary hover:text-secondary/70 flex items-center gap-1 min-w-0">
                        <ArrowSquareOut size={12} className="flex-shrink-0" />
                        <span className="truncate">{b.name}</span>
                      </a>
                      <p className="text-[10px] text-base-content/40 truncate">{b.url.replace(/^https?:\/\/(www\.)?/, '')}</p>
                      {b.notes && <p className="text-[11px] text-base-content/55 mt-0.5 line-clamp-2">{b.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button className="btn btn-ghost btn-xs p-0 h-5 w-5 min-h-0" onClick={() => startEdit(b)}><PencilSimple size={11} /></button>
                      <button className="btn btn-ghost btn-xs p-0 h-5 w-5 min-h-0 text-error opacity-70" onClick={() => removeBlog(b.id)}><Trash size={11} /></button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
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
