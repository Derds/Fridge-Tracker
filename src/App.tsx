import { useState } from 'react'
import { CatalogPage } from './pages/CatalogPage'

type Page = 'catalog' | 'inventory' | 'shopping' | 'meals'

const NAV: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'catalog', label: 'Catalog', icon: '📖' },
  { id: 'inventory', label: 'Fridge', icon: '🥦' },
  { id: 'shopping', label: 'Shopping', icon: '🛒' },
  { id: 'meals', label: 'Meals', icon: '🍽️' },
]

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-base-content/40">
      <p className="text-5xl mb-4">🚧</p>
      <p className="text-lg font-medium">{label} — coming soon</p>
    </div>
  )
}

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
        {page === 'inventory' && <ComingSoon label="Fridge inventory" />}
        {page === 'shopping' && <ComingSoon label="Shopping list" />}
        {page === 'meals' && <ComingSoon label="Meal planning" />}
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


