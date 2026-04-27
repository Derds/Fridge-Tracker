# 🗺️ Future Features Roadmap

> All core phases (1–3) and the tracker/meal planning extensions are complete.
> This document captures remaining ideas, prioritised by implementation complexity.

---

## 🟢 Low Complexity
_Self-contained, single-component changes. Can be done in a single session._

| Feature | Description |
|---------|-------------|
| **Dependency automation** | Add a Dependabot or Renovate config to keep npm deps current. Optional: GitHub Actions to auto-merge minor/patch bumps after build passes. |
| **Security review & data wipe** | Audit what's stored in IndexedDB and localStorage (meal plans, shopping habits, tracker data). Add a "Wipe all data" option in Settings. Document what is and isn't stored. |
| **Leftovers tracking** | When depleting inventory, allow marking servings as "leftover from [meal]". Shows in inventory as a leftover badge. |
| **Testing suite** | Add Vitest + React Testing Library. Cover store unit tests (mealTrackerStore, weekPlannerStore, inventoryStore) and key component interactions. Was deferred from Phase 1 — now core logic is stable enough to write meaningful tests. |
| **Shopping quantity guidance** | When generating a shopping list, warn if planned meals require more servings than are stocked. e.g. "You need 4 chicken breasts but only have 2." |
| **Seasonal ingredient badges** | Hardcode UK seasonal calendar per ingredient category. Show "in season" badge in the ingredients catalog. |
| **PWA install & offline improvements** | Show an "Install app" prompt when criteria are met. Add offline indicator banner. Handle service worker updates gracefully (prompt to reload). |
| **Optional ingredient tracking in tracker** | When a meal has optional ingredients, allow the user to tick in the tracker which optionals were actually used. Feeds into more accurate nutrition feedback (e.g. "you had the cheese topping 4 times this week"). |

---

## 🟡 Medium Complexity
_Multi-component changes, new stores, or meaningful UI work. Expect 1–2 sessions._

| Feature | Description |
|---------|-------------|
| **Rich & opinionated UI** | The current UI is functional but looks like generic DaisyUI. Develop a stronger visual identity: custom illustrated header, more interesting card layouts, handwritten-style accents, bolder use of the colour palette, typography that feels specific to a food app rather than a generic CRUD tool. |
| **Dithered meal photos** | Upload a photo of a meal — apply a dithering algorithm (e.g. Floyd-Steinberg) on-device via canvas API to give photos a distinctive lo-fi aesthetic. Store as base64 in IndexedDB on the Meal record. Display in gallery cards. Keeps storage small while being visually interesting. |
| **Richer nutrition graphs** | Expand beyond the current weekly bar chart. Add: trend lines across multiple tracked weeks, per-slot breakdowns (are you eating well at breakfast vs dinner?), a radar/spider chart for macro balance, and colour-coded day heatmaps. Use a lightweight FOSS chart lib (e.g. Chart.js or Recharts) rather than pure CSS. |
| **Big-picture eating graphs** | Monthly/quarterly view using tracker history. Charts for: meals skipped per week, protein/veg/fibre coverage trends, eating-out frequency. Complements the richer nutrition graphs above. |
| **Inventory-based recipe suggestions** | "You have chicken, spinach, garlic, pasta — here are matching meals." Match current inventory against meal ingredient lists. Show % of ingredients available. |
| **Substitution slots in meals** | Allow a meal ingredient to be marked as "any of these" (e.g. any leafy green, any pasta shape). Shopping list respects what's already in stock. |
| **Veggie / vegan swap suggestions** | Tag ingredients with common swaps (chicken → tofu, butter → olive oil). When viewing a meal, suggest a veggie or vegan variant. |
| **Cycle-synced meal suggestions** | Optional, user-controlled. Allow user to input their cycle phase (or current week). Tag meals as suitable for specific phases. Surface suggestions in planner. Privacy-sensitive — never leaves device. |
| **Nutrition details per ingredient** | Expand the nutritionTags system to allow numeric macro data (kcal, protein g, carb g, fat g) per ingredient — optional field. Surface totals on meal cards and in the tracker feedback. |

---

## 🔴 High Complexity
_Require external dependencies, new infrastructure, or significant research. Multi-session efforts._

| Feature | Description |
|---------|-------------|
| **Recipe URL scraping** | Paste a URL, attempt to parse recipe ingredients. Requires a CORS proxy or browser extension context. Parsing heuristics are fragile — consider using a structured data standard (schema.org/Recipe) where available. |
| **Supermarket price estimations** | Scrape or query open price data to estimate cost of a shopping list. Complex due to anti-scraping measures, regional price variation, and product matching. Consider: Tesco/ASDA open product APIs if available, or community price datasets. |
| **Cloud sync / backend** | Add optional account + sync so data can move between devices. Requires: auth (consider Supabase or PocketBase for FOSS options), API layer, conflict resolution for offline edits. Should remain optional — local-first stays the default. |
| **Open Food Facts integration** | Pull detailed nutritional data from the Open Food Facts open database by ingredient name or barcode. Useful for populating macro data without manual entry. FOSS-friendly (ODbL licence). |
| **Barcode scanning** | Use device camera + a barcode decoder (e.g. ZXing WASM) to scan products and auto-populate inventory. Pairs well with Open Food Facts lookup. |

---

## 💡 Moonshots
_Ideas worth keeping but with no near-term path. Revisit later._

| Feature | Notes |
|---------|-------|
| **Seasonal veg rotation planner** | Suggest a different in-season vegetable each week based on UK calendar. |
| **Meal plan costing** | Full price breakdown for a week's meals — requires price estimation feature first. |
| **Shopping route optimisation** | Given a store layout, suggest order to pick items. Needs store layout data. |
| **AI recipe generation** | "I have these 6 ingredients, generate a recipe." Requires LLM API — out of scope for FOSS-first. |

---

*Last updated: 2026-04-27 — added optional ingredient tracking, richer nutrition graphs, dithered photos, UI flavour, testing*
