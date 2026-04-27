import { create } from 'zustand'
import { db } from '../db'
import type { ShoppingList, ShoppingListItem } from '../types'

interface ShoppingStore {
  list: ShoppingList | null
  loading: boolean

  loadOrCreateList: () => Promise<void>
  addToPotential: (ingredientId: number, reason?: ShoppingListItem['reason']) => Promise<void>
  bulkAddToActual: (ingredientIds: number[]) => Promise<void>
  bulkRemoveFromActual: (ingredientIds: number[]) => Promise<void>
  moveToActual: (ingredientId: number) => Promise<void>
  removeFromActual: (ingredientId: number) => Promise<void>
  removeFromPotential: (ingredientId: number) => Promise<void>
  toggleChecked: (ingredientId: number) => Promise<void>
  clearChecked: () => Promise<void>
  addManual: (ingredientId: number) => Promise<void>
}

async function saveList(list: ShoppingList) {
  if (list.id != null) {
    await db.shoppingLists.update(list.id, {
      potentialItems: list.potentialItems,
      actualItems: list.actualItems,
    })
  }
}

export const useShoppingStore = create<ShoppingStore>((set, get) => ({
  list: null,
  loading: false,

  loadOrCreateList: async () => {
    set({ loading: true })
    // Use the most recent list, or create a fresh one
    const existing = await db.shoppingLists.orderBy('createdAt').last()
    if (existing) {
      set({ list: existing, loading: false })
    } else {
      const id = await db.shoppingLists.add({
        createdAt: new Date(),
        potentialItems: [],
        actualItems: [],
      })
      const fresh = await db.shoppingLists.get(id)
      set({ list: fresh ?? null, loading: false })
    }
  },

  addToPotential: async (ingredientId, reason = 'manual') => {
    const list = get().list
    if (!list) return
    const already = list.potentialItems.some(i => i.ingredientId === ingredientId)
    const inActual = list.actualItems.some(i => i.ingredientId === ingredientId)
    if (already || inActual) return
    const updated = { ...list, potentialItems: [...list.potentialItems, { ingredientId, reason, checked: false }] }
    await saveList(updated)
    set({ list: updated })
  },

  bulkAddToActual: async (ingredientIds) => {
    const list = get().list
    if (!list) return
    const existingIds = new Set([
      ...list.actualItems.map(i => i.ingredientId),
      ...list.potentialItems.map(i => i.ingredientId),
    ])
    const toAdd = ingredientIds.filter(id => !existingIds.has(id))
    if (toAdd.length === 0) return
    const updated = {
      ...list,
      potentialItems: list.potentialItems.filter(i => !ingredientIds.includes(i.ingredientId)),
      actualItems: [
        ...list.actualItems,
        ...toAdd.map(id => ({ ingredientId: id, checked: false, reason: 'meal-plan' as const })),
      ],
    }
    await saveList(updated)
    set({ list: updated })
  },

  bulkRemoveFromActual: async (ingredientIds) => {
    const list = get().list
    if (!list) return
    const ids = new Set(ingredientIds)
    const updated = { ...list, actualItems: list.actualItems.filter(i => !ids.has(i.ingredientId)) }
    await saveList(updated)
    set({ list: updated })
  },

  moveToActual: async (ingredientId) => {
    const list = get().list
    if (!list) return
    const inActual = list.actualItems.some(i => i.ingredientId === ingredientId)
    if (inActual) return
    const updated = {
      ...list,
      potentialItems: list.potentialItems.filter(i => i.ingredientId !== ingredientId),
      actualItems: [...list.actualItems, { ingredientId, checked: false, reason: 'manual' as const }],
    }
    await saveList(updated)
    set({ list: updated })
  },

  removeFromActual: async (ingredientId) => {
    const list = get().list
    if (!list) return
    const item = list.actualItems.find(i => i.ingredientId === ingredientId)
    const updated = {
      ...list,
      actualItems: list.actualItems.filter(i => i.ingredientId !== ingredientId),
      // put it back in potential
      potentialItems: item ? [...list.potentialItems, { ...item, checked: false }] : list.potentialItems,
    }
    await saveList(updated)
    set({ list: updated })
  },

  removeFromPotential: async (ingredientId) => {
    const list = get().list
    if (!list) return
    const updated = { ...list, potentialItems: list.potentialItems.filter(i => i.ingredientId !== ingredientId) }
    await saveList(updated)
    set({ list: updated })
  },

  toggleChecked: async (ingredientId) => {
    const list = get().list
    if (!list) return
    const updated = {
      ...list,
      actualItems: list.actualItems.map(i =>
        i.ingredientId === ingredientId ? { ...i, checked: !i.checked } : i
      ),
    }
    await saveList(updated)
    set({ list: updated })
  },

  clearChecked: async () => {
    const list = get().list
    if (!list) return
    const updated = { ...list, actualItems: list.actualItems.filter(i => !i.checked) }
    await saveList(updated)
    set({ list: updated })
  },

  addManual: async (ingredientId) => {
    const list = get().list
    if (!list) return
    const inActual = list.actualItems.some(i => i.ingredientId === ingredientId)
    const inPotential = list.potentialItems.some(i => i.ingredientId === ingredientId)
    if (inActual || inPotential) return
    const updated = { ...list, potentialItems: [...list.potentialItems, { ingredientId, reason: 'manual' as const, checked: false }] }
    await saveList(updated)
    set({ list: updated })
  },
}))
