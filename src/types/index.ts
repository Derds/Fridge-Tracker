export type IngredientRole = 'core' | 'optional' | 'substitute'

export const INGREDIENT_ROLE_LABELS: Record<IngredientRole, string> = {
  core:       'Core',
  optional:   'Optional',
  substitute: 'Substitute',
}

export const INGREDIENT_ROLE_BADGE: Record<IngredientRole, string> = {
  core:       'btn-outline',
  optional:   'btn-info',
  substitute: 'btn-warning',
}

/** Read-only badge colour classes for displaying role on meal cards */
export const INGREDIENT_ROLE_BADGE_DISPLAY: Record<IngredientRole, string> = {
  core:       'badge-ghost',
  optional:   'badge-info',
  substitute: 'badge-warning',
}

export type CookingTime = 'very-quick' | 'quick' | 'medium' | 'decadent'

export const COOKING_TIME_LABELS: Record<CookingTime, string> = {
  'very-quick': 'Under 15 min',
  'quick':      'Under 30 min',
  'medium':     '30 min – 1 hr',
  'decadent':   '1 hr+',
}

export const COOKING_TIME_BADGE: Record<CookingTime, string> = {
  'very-quick': 'badge-success',
  'quick':      'badge-info',
  'medium':     'badge-warning',
  'decadent':   'badge-error',
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
}


export type NutritionTag =
  | 'high-protein'
  | 'high-fibre'
  | 'high-carb'
  | 'high-fat'
  | 'high-iron'
  | 'high-calcium'
  | 'high-magnesium'
  | 'high-vitamin-c'
  | 'high-vitamin-d'
  | 'high-omega-3'
  | 'low-calorie'
  | 'low-fat'
  | 'low-carb'
  | 'high-sugar'
  | 'low-sugar'
  | 'low-sodium'

export type IngredientCategory =
  | 'fruit'
  | 'veg'
  | 'meat-protein'
  | 'dairy'
  | 'shelf-staple'
  | 'frozen'
  | 'snacks'
  | 'seasoning'
  | 'other'

export type ShelfLifeTier =
  | 'very-perishable'  // 1–3 days
  | 'perishable'       // 3–5 days
  | 'stable'           // 1–2 weeks
  | 'shelf-stable'     // months
  | 'frozen'           // months (frozen storage)

export interface Ingredient {
  id?: number
  name: string
  category: IngredientCategory
  shelfLifeTier: ShelfLifeTier
  storageNotes?: string
  nutritionTags?: NutritionTag[]
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
  url?: string
  ingredients: Array<{ ingredientId: number; servings: number; role?: IngredientRole }>
  notes?: string
  cookingTime?: CookingTime
  isVegetarian?: boolean
  createdAt: Date
}

export interface MealToTry {
  id?: number
  title: string
  url?: string
  notes?: string
  cookingTime?: CookingTime
  isVegetarian?: boolean
  ingredients: Array<{ ingredientId: number; servings: number; role?: IngredientRole }>
  tried: boolean
  createdAt: Date
}

export interface MealPlanDay {
  date: string  // ISO date string YYYY-MM-DD
  slots: Record<MealSlot, number[]>
  ingredientIds: number[]
  snackIngredientIds?: number[]                       // single ingredients added to snack slot
  eatingOutSlots?: Partial<Record<MealSlot, boolean>> // per-slot eating out
  highEnergy?: boolean                                // mark day as high energy
  tryMealSlots?: Partial<Record<MealSlot, number[]>>  // mealToTry IDs per slot
  /** @deprecated kept for migration of old data */
  mealIds?: number[]
  /** @deprecated use eatingOutSlots */
  eatingOut?: boolean
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
  'frozen': 180,
}
