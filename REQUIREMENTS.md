# Fridge Inventory — Requirements & Roadmap

> A personal, local-first fridge/pantry inventory and meal planning PWA.

---

## Goals

- Simplify meal planning and reduce food waste
- Always know what's in the fridge and when it expires
- Make restocking fast and shopping lists smart
- Work great on mobile (at the shop) and desktop (meal planning)

---

## Principles

- **FOSS-first**: prefer free and open-source libraries and tools at every decision point. Avoid proprietary SDKs, closed-source services, or vendor lock-in unless there is a compelling reason with no open alternative.
- **Transparency**: the app should be honest about what data it stores, where it lives, and what it does with it. No hidden telemetry, no silent network calls. If cloud sync is ever added, the user controls it explicitly.
- **User ownership**: all data belongs to the user. Export and wipe functionality should always be available.
- **Open formats**: data should be exportable in open formats (JSON, CSV) so the user is never locked into this app.

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | React + TypeScript | Type safety helps with Dexie schemas and complex state |
| Build tool | Vite | Fast dev server, minimal config |
| Styling | Tailwind CSS + DaisyUI | DaisyUI is a Tailwind plugin — no component CLI, no copied files, just classes |
| State management | Zustand | Minimal API, tiny bundle, easy cross-component inventory state |
| Local storage | Dexie.js (IndexedDB wrapper) | ORM-style API, large storage, clean migration path to a backend later |
| PWA | vite-plugin-pwa | ~5 lines of config, installable + offline for free |
| Testing | Vitest + React Testing Library | **Deferred** — add when core logic exists |
| Drag & drop | @dnd-kit | **Deferred to Phase 3** — only needed for week planner |

**Architecture:** Local-first. All data lives in the browser (IndexedDB via Dexie). Cloud sync is a future phase.

**Why DaisyUI over shadcn/ui:** shadcn requires its own CLI and copies component source into your repo. DaisyUI is a single Tailwind plugin — `npm install daisyui`, add to `tailwind.config.js`, done. Buttons, cards, modals, badges, drawers all available as CSS classes.

---

## Data Model

### Ingredient (catalog)
```
id, name, category, shelfLifeTier, storageNotes, createdAt
```
- **category**: fruit | veg | meat-protein | dairy | shelf-staple | seasoning | other
- **shelfLifeTier**: very-perishable (1-3d) | perishable (3-5d) | stable (1-2w) | shelf-stable

### InventoryItem
```
id, ingredientId, purchaseDate, expiryDate, servings, servingsRemaining, addedAt
```

### Meal
```
id, name, ingredients: [{ ingredientId, servings }], notes, imageUrl?, createdAt
```

### MealPlan
```
id, weekStartDate, days: [{ date, mealIds: [], ingredientIds: [] }]
```

### ShoppingList
```
id, createdAt,
potentialItems: [{ ingredientId, reason }],
actualItems: [{ ingredientId, quantity, checked }]
```

---

## Feature Phases

### Phase 1 — Foundation
> Goal: "I can see what's in my fridge and when things expire"

#### 1.1 Project Scaffold
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand store
- Dexie.js database with versioned schema
- vite-plugin-pwa (manifest + service worker)
- Vitest + React Testing Library

#### 1.2 Ingredient Catalog
- Pre-seeded with ~80 common ingredients (fruit, veg, meat, dairy, pantry)
- Fields: name, category, shelf life tier, storage notes
- Browse / search catalog
- Add new ingredient from a category template (all fields optional except name)
- Edit existing ingredients

#### 1.3 Inventory Management
- Add items from catalog to inventory
- Record: servings count, optional custom expiry date
- Auto-calculate expiry from shelf life tier if no custom date given
- View current inventory, sorted by expiry (soonest first)

#### 1.4 Inventory Depletion
- Quick-select ingredients, tap to reduce serving count by 1
- Reduce servings: e.g. "2 chicken breasts → 1 → 0 (removed)"
- When servings → 0: item removed from inventory, flagged as depleted

#### 1.5 Expiry View
- List of items expiring in the next 3 days
- List of already-expired items
- Bulk clear expired / clear all except selected

---

### Phase 2 — Shopping Loop
> Goal: "I can plan a shop and restock easily"

#### 2.1 Shopping List
- **Potential list**: auto-populated from depleted items + manual additions
- **Actual list**: user selects from potential list for their real shop
- Grouped by aisle/category
- Checkboxes to tick off in-store
- Add items manually to either list

#### 2.2 Easy Restock
- "I just got home" flow: bulk-add items from actual shopping list to inventory
- Auto-fills today's purchase date
- Set servings per item quickly

#### 2.3 New Ingredient
- Add an ingredient not in the catalog
- Start from a category template
- All fields except name are optional — fill in later

---

### Phase 3 — Meal Planning
> Goal: "I can plan my week's meals"

#### 3.1 Common Meals Gallery
- Save named meals with ingredient lists and optional notes
- Browse as a card gallery (grid on desktop, swipeable on mobile)
- Edit / delete meals

#### 3.2 Week View Planner
- 7-column week view
- Drag meals or individual ingredients into day slots
- View planned ingredients at a glance

#### 3.3 Meal → Shopping List
- Compare planned meal ingredients against current inventory
- Generate a shopping list of what's missing
- Highlight ingredients that will expire before their planned use date

---

### Phase 4 — Future Ideas
> Tracked for later — not in current scope

| Feature | Notes |
|---------|-------|
| Nutritional info | High-level tags per ingredient (high protein, high fibre, etc.), then meal totals |
| Recipe detection | Scrape recipes from a URL, parse ingredients |
| Seasonal suggestions | Suggest in-season vegetables for the current month |
| Inventory-based recipe suggestions | "You have these 5 items — here are meals you can make" |
| Price estimations | Web-search specific supermarkets for price data |
| Meal photo gallery | Upload + compress/dither images of meals |
| Cloud sync | Backend + auth for cross-device sync |
| Shopping quantity guidance | Analyse planned meals vs servings, flag over/undershopping |
| Rich colour theme & opinionated UI | Move away from generic component-library defaults — develop a distinctive visual identity with a bold colour palette, custom typography, and styling that feels specific to this app rather than a generic CRUD tool |
| Dependency update automation | Add a Dependabot config or Renovate bot to keep npm dependencies current; set up a GitHub Actions workflow to auto-merge minor/patch updates after CI passes |
| Security review | Audit any personal data stored locally (ingredient preferences, meal plans, shopping habits) — review IndexedDB exposure, consider data export/wipe tooling, and assess any future backend/sync surface area for auth and data-in-transit risks |

---

## Non-Functional Requirements

- **Responsive**: works on mobile (320px+) and desktop
- **Offline-capable**: PWA, data stored locally — works without internet
- **Installable**: "Add to Home Screen" via PWA manifest
- **Fast**: Dexie queries should feel instant; no loading spinners for local reads
- **Accessible**: DaisyUI components follow semantic HTML; keyboard navigable

---

## Build Order Rationale

Simple → complex, always having a usable app at each phase:
1. Phase 1 gives a daily-use tool (fridge tracker)
2. Phase 2 closes the shop loop (inventory → depletion → shopping → restock)
3. Phase 3 adds meal planning on top of a solid foundation
4. Phase 4 is enhancement — each feature is independently addable

---

*Last updated: 2026-04-27 — added rich UI, dependency automation, and security review to Phase 4*
