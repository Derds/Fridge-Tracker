import { create } from 'zustand'
import { db } from '../db'
import type { MealTrackerWeek, TrackedDay, TrackedSlot, MealSlot, MealPlanDay } from '../types'
import { MEAL_SLOTS, emptyTrackedDay, emptyTrackedSlot } from '../types'

interface MealTrackerStore {
  tracker: MealTrackerWeek | null
  loading: boolean
  loadWeek: (weekStartDate: string) => Promise<void>
  initFromPlan: (weekStartDate: string, planDays: MealPlanDay[]) => Promise<void>
  /** Merge plan changes into existing tracker — only updates slots the user hasn't manually edited */
  syncFromPlan: (planDays: MealPlanDay[]) => Promise<void>
  updateSlot: (date: string, slot: MealSlot, patch: Partial<TrackedSlot>) => Promise<void>
  clearWeek: (weekStartDate: string) => Promise<void>
  exportCSV: (mealNameMap: Map<number, string>) => void
  importCSV: (csv: string, mealMap: Map<string, number>) => Promise<{ imported: number; errors: string[] }>
}

export function getWeekDays(weekStart: string): string[] {
  const base = new Date(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function buildEmptyWeek(weekStartDate: string): MealTrackerWeek {
  const days = getWeekDays(weekStartDate).map(date => emptyTrackedDay(date))
  const now = new Date()
  return { weekStartDate, days, createdAt: now, updatedAt: now }
}

function planDayToTrackedDay(planDay: MealPlanDay): TrackedDay {
  const slots = {} as Record<MealSlot, TrackedSlot>
  for (const slot of MEAL_SLOTS) {
    const mealIds = planDay.slots[slot] ?? []
    slots[slot] = {
      plannedMealId: mealIds[0],  // take first planned meal per slot
      skipped: false,
      eatingOut: planDay.eatingOutSlots?.[slot] ?? false,
    }
  }
  return { date: planDay.date, slots }
}

export const useMealTrackerStore = create<MealTrackerStore>((set, get) => ({
  tracker: null,
  loading: false,

  loadWeek: async (weekStartDate) => {
    set({ loading: true })
    const existing = await db.mealTrackers.where('weekStartDate').equals(weekStartDate).first()
    set({ tracker: existing ?? null, loading: false })
  },

  initFromPlan: async (weekStartDate, planDays) => {
    const now = new Date()
    const weekDates = getWeekDays(weekStartDate)
    const days: TrackedDay[] = weekDates.map(date => {
      const planDay = planDays.find(d => d.date === date)
      return planDay ? planDayToTrackedDay(planDay) : emptyTrackedDay(date)
    })
    const tracker: MealTrackerWeek = { weekStartDate, days, createdAt: now, updatedAt: now }
    const id = await db.mealTrackers.add(tracker)
    set({ tracker: { ...tracker, id: id as number } })
  },

  syncFromPlan: async (planDays) => {
    const { tracker } = get()
    if (!tracker?.id) return

    const days = tracker.days.map(d => {
      const planDay = planDays.find(p => p.date === d.date)
      if (!planDay) return d

      const slots = { ...d.slots }
      for (const slot of MEAL_SLOTS) {
        const existing = slots[slot]
        // Only update if the slot hasn't been manually edited by the user
        const isEdited = existing?.actualMealId || existing?.actualMealName || existing?.skipped || existing?.eatingOut
        if (!isEdited) {
          const mealIds = planDay.slots[slot] ?? []
          slots[slot] = {
            ...emptyTrackedSlot(),
            plannedMealId: mealIds[0],
            eatingOut: planDay.eatingOutSlots?.[slot] ?? false,
          }
        }
      }
      return { ...d, slots }
    })

    const updatedAt = new Date()
    await db.mealTrackers.update(tracker.id, { days, updatedAt })
    set({ tracker: { ...tracker, days, updatedAt } })
  },

  updateSlot: async (date, slot, patch) => {
    const { tracker } = get()
    if (!tracker?.id) return
    const days = tracker.days.map(d => {
      if (d.date !== date) return d
      return { ...d, slots: { ...d.slots, [slot]: { ...(d.slots[slot] ?? emptyTrackedSlot()), ...patch } } }
    })
    const updatedAt = new Date()
    await db.mealTrackers.update(tracker.id, { days, updatedAt })
    set({ tracker: { ...tracker, days, updatedAt } })
  },

  clearWeek: async (weekStartDate) => {
    const existing = await db.mealTrackers.where('weekStartDate').equals(weekStartDate).first()
    if (existing?.id) await db.mealTrackers.delete(existing.id)
    set({ tracker: null })
  },

  exportCSV: (mealNameMap) => {
    const { tracker } = get()
    if (!tracker) return
    const rows: string[] = ['date,slot,planned_meal,actual_meal,skipped,eating_out']
    for (const day of tracker.days) {
      for (const slot of MEAL_SLOTS) {
        const s = day.slots[slot]
        if (!s) continue
        const planned = s.plannedMealId ? (mealNameMap.get(s.plannedMealId) ?? `#${s.plannedMealId}`) : ''
        const actual = s.actualMealId
          ? (mealNameMap.get(s.actualMealId) ?? `#${s.actualMealId}`)
          : (s.actualMealName ?? '')
        rows.push(`${day.date},${slot},"${planned}","${actual}",${s.skipped ? 'yes' : 'no'},${s.eatingOut ? 'yes' : 'no'}`)
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meal-tracker-${tracker.weekStartDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },

  importCSV: async (csv, mealMap) => {
    const lines = csv.trim().split('\n')
    const header = lines[0].toLowerCase()
    if (!header.includes('date') || !header.includes('slot')) {
      return { imported: 0, errors: ['Invalid CSV format — expected columns: date, slot, planned_meal, actual_meal, skipped, eating_out'] }
    }
    const cols = header.split(',').map(c => c.replace(/"/g, '').trim())
    const idx = (name: string) => cols.indexOf(name)
    const errors: string[] = []
    const weekMap = new Map<string, MealTrackerWeek>()

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? []
      const get = (col: string) => (parts[idx(col)] ?? '').replace(/"/g, '').trim()

      const date = get('date')
      const slot = get('slot') as MealSlot
      if (!date || !MEAL_SLOTS.includes(slot)) { errors.push(`Row ${i + 1}: invalid date or slot`); continue }

      const monday = new Date(date)
      const day = monday.getDay()
      const diff = (day === 0 ? -6 : 1 - day)
      monday.setDate(monday.getDate() + diff)
      const weekStart = monday.toISOString().slice(0, 10)

      if (!weekMap.has(weekStart)) {
        const existing = await db.mealTrackers.where('weekStartDate').equals(weekStart).first()
        weekMap.set(weekStart, existing ?? buildEmptyWeek(weekStart))
      }

      const week = weekMap.get(weekStart)!
      let dayEntry = week.days.find(d => d.date === date)
      if (!dayEntry) { dayEntry = emptyTrackedDay(date); week.days.push(dayEntry) }

      const plannedName = get('planned_meal')
      const actualName = get('actual_meal')
      dayEntry.slots[slot] = {
        plannedMealId: plannedName ? mealMap.get(plannedName.toLowerCase()) : undefined,
        actualMealId: actualName ? mealMap.get(actualName.toLowerCase()) : undefined,
        actualMealName: actualName && !mealMap.get(actualName.toLowerCase()) ? actualName : undefined,
        skipped: get('skipped') === 'yes',
        eatingOut: get('eating_out') === 'yes',
      }
    }

    let imported = 0
    for (const [weekStart, week] of weekMap) {
      week.updatedAt = new Date()
      const existing = await db.mealTrackers.where('weekStartDate').equals(weekStart).first()
      if (existing?.id) {
        await db.mealTrackers.update(existing.id, { days: week.days, updatedAt: week.updatedAt })
      } else {
        await db.mealTrackers.add(week)
      }
      imported++
    }
    return { imported, errors }
  },
}))
