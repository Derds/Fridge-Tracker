import { useState } from 'react'
import { CatalogPage } from './pages/CatalogPage'
import { InventoryPage } from './pages/InventoryPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { MealsPage } from './pages/MealsPage'

type Page = 'catalog' | 'inventory' | 'shopping' | 'meals'

const NAV: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'catalog', label: 'Catalog', icon: '📖' },
  { id: 'inventory', label: 'Fridge', icon: '🥦' },
  { id: 'shopping', label: 'Shopping', icon: '🛒' },
  { id: 'meals', label: 'Meals', icon: '🍽️' },
]

function App() {
  const [page, setPage] = useState<Page>('catalog')

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Top navbar */}
      <header className="navbar bg-base-200 shadow-sm sticky top-0 z-10">
        <div className="navbar-start">
          <span className="text-lg font-bold text-primary ml-2">🥦 Fridge</span>
        </div>
        <div className="navbar-end hidden sm:flex gap-1 mr-2">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`btn btn-sm ${page === n.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20 sm:pb-0">
        {page === 'catalog' && <CatalogPage />}
        {page === 'inventory' && <InventoryPage />}
        {page === 'shopping' && <ShoppingPage />}
        {page === 'meals' && <MealsPage onNavigateToShopping={() => setPage('shopping')} />}
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="btm-nav sm:hidden">
        {NAV.map(n => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={page === n.id ? 'active text-primary' : ''}
          >
            <span className="text-xl">{n.icon}</span>
            <span className="btm-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App


