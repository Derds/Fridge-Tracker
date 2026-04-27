import { create } from 'zustand'
import { db } from '../db'
import type { Ingredient, IngredientCategory, ShelfLifeTier } from '../types'

interface IngredientStore {
  ingredients: Ingredient[]
  loading: boolean
  error: string | null

  loadIngredients: () => Promise<void>
  addIngredient: (ingredient: Omit<Ingredient, 'id' | 'createdAt'>) => Promise<number>
  updateIngredient: (id: number, updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>) => Promise<void>
  deleteIngredient: (id: number) => Promise<void>
}

export const useIngredientStore = create<IngredientStore>((set) => ({
  ingredients: [],
  loading: false,
  error: null,

  loadIngredients: async () => {
    set({ loading: true, error: null })
    try {
      const ingredients = await db.ingredients.orderBy('name').toArray()
      set({ ingredients, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  addIngredient: async (ingredient) => {
    const id = await db.ingredients.add({ ...ingredient, createdAt: new Date() })
    const all = await db.ingredients.orderBy('name').toArray()
    set({ ingredients: all })
    return id as number
  },

  updateIngredient: async (id, updates) => {
    await db.ingredients.update(id, updates)
    const all = await db.ingredients.orderBy('name').toArray()
    set({ ingredients: all })
  },

  deleteIngredient: async (id) => {
    await db.ingredients.delete(id)
    set(state => ({ ingredients: state.ingredients.filter(i => i.id !== id) }))
  },
}))

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  'fruit': '🍎 Fruit',
  'veg': '🥦 Veg',
  'meat-protein': '🥩 Meat & Protein',
  'dairy': '🧀 Dairy',
  'shelf-staple': '🥫 Shelf Staple',
  'frozen': '🧊 Frozen',
  'snacks': '🍿 Snacks',
  'seasoning': '🧂 Seasoning',
  'other': '📦 Other',
}

export const SHELF_LIFE_LABELS: Record<ShelfLifeTier, string> = {
  'very-perishable': 'Very perishable (1–3 days)',
  'perishable': 'Perishable (3–5 days)',
  'stable': 'Stable (1–2 weeks)',
  'shelf-stable': 'Shelf stable (months)',
}

export const CATEGORY_ORDER: IngredientCategory[] = [
  'fruit', 'veg', 'meat-protein', 'dairy', 'shelf-staple', 'frozen', 'snacks', 'seasoning', 'other',
]
