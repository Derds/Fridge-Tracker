# 🧊 Fridge Inventory

A personal, local-first PWA for tracking what's in your fridge and freezer, managing expiry dates, building shopping lists, and planning meals.

All your data lives on your device — no accounts, no tracking, no cloud required.

---

## Getting started

### Install as an app (recommended)

Fridge Inventory is a Progressive Web App (PWA). You can install it directly from your browser — no app store needed.

**On mobile (Chrome / Safari):**
1. Open the app URL in your browser
2. Tap the share icon → **Add to Home Screen**
3. Launch it like any other app — it works offline

**On desktop (Chrome / Edge):**
1. Open the app URL
2. Click the install icon in the address bar (or open the browser menu → **Install Fridge Inventory**)

### Run locally (development)

Requirements: **Node.js 18+** and **npm**

```bash
git clone https://github.com/Derds/fridge-inventory.git
cd fridge-inventory
./setup.sh
```

The setup script installs dependencies and starts the dev server. The app will open at `http://localhost:5173`.

Or manually:

```bash
npm install --legacy-peer-deps
npm run dev
```

To build for production:

```bash
npm run build
```

---

## How to use the app

### Ingredient Catalog

The catalog is a library of ingredients you can track. It comes pre-seeded with around 240 common UK supermarket ingredients across categories: fruit, veg, meat & protein, dairy, shelf staples, frozen, snacks, seasonings, plus Italian and Asian cooking staples.

- **Search** by name using the search bar
- **Filter** by category or shelf-life tier using the dropdowns
- **Add** a new ingredient with the **+ New ingredient** button — only the name is required
- **Edit or delete** any ingredient by tapping the pencil icon on its card
- **Nutrition tags** (e.g. high-protein, high-fibre, low-fat) can be added when editing an ingredient — tap the tag pills to toggle them on or off

---

### Fridge (Inventory)

The Fridge tab shows everything currently in stock, sorted by expiry date (soonest first).

**Adding items to your fridge:**
1. Tap **+ Add item**
2. Search for the ingredient in the catalog
3. Set the number of servings and optionally a custom expiry date
4. Tap **Add to fridge** — expiry is calculated automatically from the ingredient's shelf-life tier if you don't set one

**Using up items:**
- Tap the **−** button on any item to reduce the serving count by 1
- When servings reach 0, the item is removed from inventory and flagged as depleted (it will appear in Shopping Suggestions)

**Expiry management:**
- Items expiring within 3 days appear at the top with a warning badge
- Already-expired items are shown in a collapsible **Expired** section at the bottom
- Tap **Clear all expired** to remove them in bulk

---

### Shopping List

The Shopping tab has two views:

**My list** — your actual shopping list, grouped by category
- Tick items off as you shop using the checkboxes
- Tap **Clear ticked** to remove checked items when you're done
- Tap ✕ on any item to remove it and send it back to Suggestions
- Tap **+ Add item** to search the catalog and add anything manually

**Suggestions** — auto-populated from depleted inventory items
- Items that have run out appear here automatically
- Tap **Add to list** to move an item to your actual shopping list
- Tap ✕ to dismiss a suggestion without adding it

---

### Meals (coming soon)

Phase 3 will add a meal gallery and week planner — save named meals with ingredient lists, then drag them into a weekly plan and generate a shopping list from what's missing.

---

## Data & privacy

- All data is stored locally in your browser using IndexedDB
- Nothing is sent to any server
- No analytics, no telemetry, no accounts
- To wipe your data: open browser DevTools → Application → IndexedDB → delete the `FridgeDatabase` database

Export and import functionality is planned for a future release.

---

## Project documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — full requirements, tech stack decisions, and feature roadmap
- [`docs/PROJECT_IDEA.md`](docs/PROJECT_IDEA.md) — original project brief and early ideas

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS + DaisyUI |
| State | Zustand |
| Storage | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa |

All dependencies are free and open source.
