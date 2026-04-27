import Dexie, { type Table } from 'dexie'
import type { Ingredient, InventoryItem, Meal, MealPlan, MealToTry, MealTrackerWeek, ShoppingList } from '../types'
import { SEED_INGREDIENTS, NEW_INGREDIENTS_V3, NEW_INGREDIENTS_V4, NEW_INGREDIENTS_V6 } from '../data/seedIngredients'

export class FridgeDatabase extends Dexie {
  ingredients!: Table<Ingredient>
  inventory!: Table<InventoryItem>
  meals!: Table<Meal>
  mealPlans!: Table<MealPlan>
  shoppingLists!: Table<ShoppingList>
  mealsToTry!: Table<MealToTry>
  mealTrackers!: Table<MealTrackerWeek>

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

    // v3: adds pasta types, seeds, baking ingredients
    this.version(3).stores({}).upgrade(async tx => {
      const now = new Date()
      const table = tx.table<Ingredient>('ingredients')
      for (const ing of NEW_INGREDIENTS_V3) {
        const exists = await table.where('name').equalsIgnoreCase(ing.name).count()
        if (exists === 0) {
          await table.add({ ...ing, createdAt: now })
        }
      }
    })

    // v4: adds ready meals, frozen staples, chilled ready meals
    this.version(4).stores({}).upgrade(async tx => {
      const now = new Date()
      const table = tx.table<Ingredient>('ingredients')
      for (const ing of NEW_INGREDIENTS_V4) {
        const exists = await table.where('name').equalsIgnoreCase(ing.name).count()
        if (exists === 0) {
          await table.add({ ...ing, createdAt: now })
        }
      }
    })

    // v5: adds mealsToTry table
    this.version(5).stores({
      mealsToTry: '++id, title, tried',
    })

    // v6: adds UK seasonings, root vegetables, salad greens
    this.version(6).stores({}).upgrade(async tx => {
      const now = new Date()
      const table = tx.table<Ingredient>('ingredients')
      for (const ing of NEW_INGREDIENTS_V6) {
        const exists = await table.where('name').equalsIgnoreCase(ing.name).count()
        if (exists === 0) {
          await table.add({ ...ing, createdAt: now })
        }
      }
    })

    // v7: adds mealTrackers table
    this.version(7).stores({
      mealTrackers: '++id, weekStartDate',
    })

    this.on('populate', () => this.seedIngredients())
  }

  private async seedIngredients() {
    const now = new Date()
    await this.ingredients.bulkAdd(
      [...SEED_INGREDIENTS, ...NEW_INGREDIENTS_V3, ...NEW_INGREDIENTS_V4, ...NEW_INGREDIENTS_V6].map(i => ({ ...i, createdAt: now }))
    )
  }
}

export const db = new FridgeDatabase()
