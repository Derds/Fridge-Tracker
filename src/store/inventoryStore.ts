import { create } from 'zustand'
import { db } from '../db'
import type { InventoryItem } from '../types'
import { SHELF_LIFE_DAYS } from '../types'

export interface InventoryItemWithIngredient extends InventoryItem {
  ingredientName: string
  ingredientCategory: string
}

interface InventoryStore {
  items: InventoryItemWithIngredient[]
  loading: boolean
  error: string | null

  loadInventory: () => Promise<void>
  addItem: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => Promise<void>
  depleteItem: (id: number) => Promise<void>   // reduce servingsRemaining by 1
  incrementItem: (id: number) => Promise<void> // add one serving (e.g. leftovers)
  removeItem: (id: number) => Promise<void>
  clearExpired: (keepIds?: number[]) => Promise<void>
}

async function withIngredientNames(items: InventoryItem[]): Promise<InventoryItemWithIngredient[]> {
  const ids = [...new Set(items.map(i => i.ingredientId))]
  const ingredients = await db.ingredients.bulkGet(ids)
  const map = new Map(ingredients.filter(Boolean).map(i => [i!.id!, i!]))
  return items.map(item => ({
    ...item,
    ingredientName: map.get(item.ingredientId)?.name ?? 'Unknown',
    ingredientCategory: map.get(item.ingredientId)?.category ?? 'other',
  }))
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadInventory: async () => {
    set({ loading: true, error: null })
    try {
      const raw = await db.inventory.orderBy('expiryDate').toArray()
      const items = await withIngredientNames(raw)
      set({ items, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  addItem: async (item) => {
    await db.inventory.add({ ...item, addedAt: new Date() })
    await get().loadInventory()
  },

  depleteItem: async (id) => {
    const item = await db.inventory.get(id)
    if (!item) return
    if (item.servingsRemaining <= 1) {
      await db.inventory.delete(id)
    } else {
      await db.inventory.update(id, { servingsRemaining: item.servingsRemaining - 1 })
    }
    await get().loadInventory()
  },

  incrementItem: async (id) => {
    const item = await db.inventory.get(id)
    if (!item) return
    // Allow going above original servings count (e.g. leftovers added)
    await db.inventory.update(id, { servingsRemaining: item.servingsRemaining + 1 })
    await get().loadInventory()
  },

  removeItem: async (id) => {
    await db.inventory.delete(id)
    set(state => ({ items: state.items.filter(i => i.id !== id) }))
  },

  clearExpired: async (keepIds = []) => {
    const now = new Date()
    const expired = await db.inventory.where('expiryDate').below(now).toArray()
    const toDelete = expired.filter(i => !keepIds.includes(i.id!)).map(i => i.id!)
    await db.inventory.bulkDelete(toDelete)
    await get().loadInventory()
  },
}))

/** Calculate expiry date from purchase date and shelf life tier */
export function calcExpiryDate(purchaseDate: Date, shelfLifeTier: keyof typeof SHELF_LIFE_DAYS): Date {
  const days = SHELF_LIFE_DAYS[shelfLifeTier]
  const d = new Date(purchaseDate)
  d.setDate(d.getDate() + days)
  return d
}

/** Days until expiry (negative = already expired) */
export function daysUntilExpiry(expiryDate: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function expiryLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `${days}d left`
}

export function expiryBadgeClass(days: number): string {
  if (days < 0) return 'badge-error'
  if (days <= 1) return 'badge-error'
  if (days <= 3) return 'badge-warning'
  if (days <= 7) return 'badge-info'
  return 'badge-success'
}
