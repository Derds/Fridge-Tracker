import Dexie, { type Table } from 'dexie'
import type { Ingredient, InventoryItem, Meal, MealPlan, ShoppingList } from '../types'
import { SEED_INGREDIENTS } from '../data/seedIngredients'

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

    // v2: adds nutritionTags to ingredients (multi-value index)
    this.version(2).stores({
      ingredients: '++id, name, category, shelfLifeTier, *nutritionTags',
    })

    this.on('populate', () => this.seedIngredients())
  }

  private async seedIngredients() {
    const now = new Date()
    await this.ingredients.bulkAdd(
      SEED_INGREDIENTS.map(i => ({ ...i, createdAt: now }))
    )
  }
}

export const db = new FridgeDatabase()
