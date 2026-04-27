import Dexie, { type Table } from 'dexie'
import type { Ingredient, InventoryItem, Meal, MealPlan, ShoppingList } from '../types'
import { SEED_INGREDIENTS, NEW_INGREDIENTS_V3 } from '../data/seedIngredients'

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

    this.on('populate', () => this.seedIngredients())
  }

  private async seedIngredients() {
    const now = new Date()
    await this.ingredients.bulkAdd(
      [...SEED_INGREDIENTS, ...NEW_INGREDIENTS_V3].map(i => ({ ...i, createdAt: now }))
    )
  }
}

export const db = new FridgeDatabase()
