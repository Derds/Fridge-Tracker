import Dexie, { type Table } from 'dexie'
import type { Ingredient, InventoryItem, Meal, MealPlan, ShoppingList } from '../types'

export class FridgeDatabase extends Dexie {
  ingredients!: Table<Ingredient>
  inventory!: Table<InventoryItem>
  meals!: Table<Meal>
  mealPlans!: Table<MealPlan>
  shoppingLists!: Table<ShoppingList>

  constructor() {
    super('fridge-inventory')

    this.version(1).stores({
      ingredients: '++id, name, category, shelfLifeTier',
      inventory: '++id, ingredientId, expiryDate, servingsRemaining',
      meals: '++id, name',
      mealPlans: '++id, weekStartDate',
      shoppingLists: '++id, createdAt',
    })
  }
}

export const db = new FridgeDatabase()
