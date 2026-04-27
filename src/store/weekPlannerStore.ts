import { create } from 'zustand'
import { db } from '../db'
import type { MealPlan, MealPlanDay } from '../types'

function toLocalISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getMonday(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return toLocalISO(d)
}

export function getWeekDays(weekStart: string): string[] {
  const [y, m, day] = weekStart.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => toLocalISO(new Date(y, m - 1, day + i)))
}

export function formatWeekLabel(weekStart: string): string {
  const days = getWeekDays(weekStart)
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(days[0])} – ${fmt(days[6])}`
}

export function formatDayLabel(date: string, format: 'short' | 'full' = 'short'): string {
  const d = new Date(date + 'T12:00:00')
  return format === 'full'
    ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

function makeEmptyPlan(weekStart: string): Omit<MealPlan, 'id'> {
  return {
    weekStartDate: weekStart,
    days: getWeekDays(weekStart).map(date => ({ date, mealIds: [], ingredientIds: [] })),
    createdAt: new Date(),
  }
}

async function savePlanDays(plan: MealPlan, days: MealPlanDay[]) {
  if (plan.id != null) await db.mealPlans.update(plan.id, { days })
}

interface WeekPlannerStore {
  plan: MealPlan | null
  weekStart: string
  loading: boolean
  loadWeek: (weekStart?: string) => Promise<void>
  addMealToDay: (date: string, mealId: number) => Promise<void>
  removeMealFromDay: (date: string, mealId: number) => Promise<void>
}

export const useWeekPlannerStore = create<WeekPlannerStore>((set, get) => ({
  plan: null,
  weekStart: getMonday(),
  loading: false,

  loadWeek: async (weekStart) => {
    const ws = weekStart ?? getMonday()
    set({ loading: true, weekStart: ws })
    let plan = await db.mealPlans.where('weekStartDate').equals(ws).first()
    if (!plan) {
      const id = await db.mealPlans.add(makeEmptyPlan(ws) as MealPlan)
      plan = await db.mealPlans.get(id)
    }
    set({ plan: plan ?? null, loading: false })
  },

  addMealToDay: async (date, mealId) => {
    const { plan } = get()
    if (!plan) return
    const days = plan.days.map(d =>
      d.date === date && !d.mealIds.includes(mealId)
        ? { ...d, mealIds: [...d.mealIds, mealId] }
        : d
    )
    await savePlanDays(plan, days)
    set({ plan: { ...plan, days } })
  },

  removeMealFromDay: async (date, mealId) => {
    const { plan } = get()
    if (!plan) return
    const days = plan.days.map(d =>
      d.date === date ? { ...d, mealIds: d.mealIds.filter(id => id !== mealId) } : d
    )
    await savePlanDays(plan, days)
    set({ plan: { ...plan, days } })
  },
}))
