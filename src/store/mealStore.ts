import { create } from 'zustand'
import { db } from '../db'
import type { Meal } from '../types'

interface MealStore {
  meals: Meal[]
  loading: boolean
  loadMeals: () => Promise<void>
  addMeal: (data: Omit<Meal, 'id' | 'createdAt'>) => Promise<number>
  updateMeal: (id: number, changes: Partial<Pick<Meal, 'name' | 'ingredients' | 'notes' | 'cookingTime'>>) => Promise<void>
  deleteMeal: (id: number) => Promise<void>
}

export const useMealStore = create<MealStore>((set, get) => ({
  meals: [],
  loading: false,

  loadMeals: async () => {
    set({ loading: true })
    const meals = await db.meals.orderBy('name').toArray()
    set({ meals, loading: false })
  },

  addMeal: async (data) => {
    const id = await db.meals.add({ ...data, createdAt: new Date() })
    await get().loadMeals()
    return id as number
  },

  updateMeal: async (id, changes) => {
    await db.meals.update(id, changes)
    set(s => ({ meals: s.meals.map(m => m.id === id ? { ...m, ...changes } : m) }))
  },

  deleteMeal: async (id) => {
    await db.meals.delete(id)
    set(s => ({ meals: s.meals.filter(m => m.id !== id) }))
  },
}))
