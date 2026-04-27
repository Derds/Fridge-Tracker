import { create } from 'zustand'
import { db } from '../db'
import type { MealToTry } from '../types'

interface MealToTryStore {
  mealsToTry: MealToTry[]
  loading: boolean
  loadMealsToTry: () => Promise<void>
  addMealToTry: (data: Omit<MealToTry, 'id' | 'createdAt'>) => Promise<number>
  updateMealToTry: (id: number, data: Partial<Omit<MealToTry, 'id' | 'createdAt'>>) => Promise<void>
  deleteMealToTry: (id: number) => Promise<void>
  markTried: (id: number) => Promise<void>
}

export const useMealToTryStore = create<MealToTryStore>((set, get) => ({
  mealsToTry: [],
  loading: false,

  loadMealsToTry: async () => {
    set({ loading: true })
    const mealsToTry = await db.mealsToTry.orderBy('createdAt').reverse().toArray()
    set({ mealsToTry, loading: false })
  },

  addMealToTry: async (data) => {
    const id = await db.mealsToTry.add({ ...data, createdAt: new Date() } as MealToTry)
    await get().loadMealsToTry()
    return id as number
  },

  updateMealToTry: async (id, data) => {
    await db.mealsToTry.update(id, data)
    await get().loadMealsToTry()
  },

  deleteMealToTry: async (id) => {
    await db.mealsToTry.delete(id)
    set(s => ({ mealsToTry: s.mealsToTry.filter(m => m.id !== id) }))
  },

  markTried: async (id) => {
    await db.mealsToTry.update(id, { tried: true })
    set(s => ({ mealsToTry: s.mealsToTry.map(m => m.id === id ? { ...m, tried: true } : m) }))
  },
}))
