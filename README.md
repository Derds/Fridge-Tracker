# 🥬 Fridge Inventory

> A personal, local-first PWA for tracking your fridge, planning meals, and building smarter shopping lists.
> **All data lives on your device — no accounts, no tracking, no cloud.**

---

## ✨ Features

### 🥗 Ingredients catalog
- Browse all ingredients organised by category (veg, dairy, meat, shelf staples, frozen, seasonings and more)
- Add custom ingredients with shelf life, storage notes, and nutrition tags
- Pre-loaded with **200+ UK-friendly ingredients** including root vegetables, salad greens, seasonings, frozen staples, baking ingredients and ready meals

### 🧊 Inventory (fridge & freezer)
- Track what you have in stock with servings and expiry dates
- **Expiry alerts** — items nearing or past their use-by date are flagged
- Add or subtract servings (great for leftovers)
- Sort by category for quick scanning
- Add inventory items directly from the ingredients catalog
- Import items via CSV

### 🍳 Meals
- Build a library of your favourite meals with ingredients, cooking times, veggie flags and notes
- Attach a **recipe URL** to any meal for quick reference
- Ingredients marked as **core**, **optional** or **substitute** within each recipe
- Browse by cooking time — from *very quick* (< 15 min) to *slow / decadent* (1 hr+)
- Import and export your meals as JSON for backup or device migration

### 📅 Week planner
- Drag-and-drop meal planning across a 7-day grid
- **Four slots per day**: breakfast, lunch, dinner and snack
- Mark individual meal slots as **eating out** (🍴 per slot, not per day)
- Mark days as **high energy** (⚡) for days when nutrition matters most
- Schedule **meals to try** directly into the planner
- Add single snack ingredients to snack slots directly

### ✨ Meals to try
- Collect recipe URLs, blogs and ideas you want to make some day
- Tag with cooking time, veggie flag, notes and ingredient list
- **"Meal tried!"** button converts a saved recipe into a full meal in one click
- **Recipe blogs panel** — bookmark your favourite recipe sites and blogs for quick browsing

### 🛒 Shopping list
- Build lists manually or **generate from your meal plan**
- Core and optional ingredients are separated — optional ones are deselected by default
- Suggestions from recently used and planned ingredients
- Sort and filter by category
- Tick items off as you shop — ticked items automatically appear in your inventory

### 📊 Nutrition summary
- Visual weekly chart showing how balanced your planned meals are
- Tracks protein, fibre, iron, vitamins, calcium and more across the week
- Hidden by default — show when you want a nutrition overview

### ⚙️ Settings
- **Three colour themes**: Warm Pink (default), Classic, Dark
- **Three font pairings**: Simple (system), Kitchen (Pacifico + Nunito), Cookbook (Playfair Display + Source Sans 3)
- All preferences persisted locally

---

## 🚀 Getting started

### Install as a PWA (recommended)

**On mobile (Chrome / Safari):**
1. Open the app URL in your browser
2. Tap the share icon → **Add to Home Screen**

**On desktop (Chrome / Edge):**
1. Open the app URL
2. Click the install icon in the address bar

### Run locally

Requires **Node.js 18+**

```bash
git clone https://github.com/Derds/fridge-inventory.git
cd fridge-inventory
npm install --legacy-peer-deps
npm run dev
```

```bash
npm run build    # production build
```

---

## 🛠 Tech stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 + DaisyUI v5 |
| Local storage | Dexie.js (IndexedDB) |
| State | Zustand |
| Drag & drop | @dnd-kit/core |
| Icons | Phosphor Icons |
| PWA | vite-plugin-pwa |

---

*Made for personal use — open source, no telemetry, no backend.*
