export type IngredientCategory =
  | 'fruit'
  | 'veg'
  | 'meat-protein'
  | 'dairy'
  | 'shelf-staple'
  | 'seasoning'
  | 'other'

export type ShelfLifeTier =
  | 'very-perishable'  // 1–3 days
  | 'perishable'       // 3–5 days
  | 'stable'           // 1–2 weeks
  | 'shelf-stable'     // months

export interface Ingredient {
  id?: number
  name: string
  category: IngredientCategory
  shelfLifeTier: ShelfLifeTier
  storageNotes?: string
  createdAt: Date
}

export interface InventoryItem {
  id?: number
  ingredientId: number
  purchaseDate: Date
  expiryDate: Date
  servings: number
  servingsRemaining: number
  addedAt: Date
}

export interface Meal {
  id?: number
  name: string
  ingredients: Array<{ ingredientId: number; servings: number }>
  notes?: string
  createdAt: Date
}

export interface MealPlanDay {
  date: string  // ISO date string YYYY-MM-DD
  mealIds: number[]
  ingredientIds: number[]
}

export interface MealPlan {
  id?: number
  weekStartDate: string  // ISO date string, always a Monday
  days: MealPlanDay[]
  createdAt: Date
}

export interface ShoppingListItem {
  ingredientId: number
  quantity?: number
  checked: boolean
  reason?: 'depleted' | 'meal-plan' | 'manual'
}

export interface ShoppingList {
  id?: number
  createdAt: Date
  potentialItems: ShoppingListItem[]
  actualItems: ShoppingListItem[]
}

/** Default shelf life in days by tier */
export const SHELF_LIFE_DAYS: Record<ShelfLifeTier, number> = {
  'very-perishable': 2,
  'perishable': 4,
  'stable': 10,
  'shelf-stable': 180,
}
