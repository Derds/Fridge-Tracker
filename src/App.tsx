import { useState } from 'react'
import { ListBullets, Package, ShoppingCart, ForkKnife, Leaf, Gear, type Icon } from '@phosphor-icons/react'
import { CatalogPage } from './pages/CatalogPage'
import { InventoryPage } from './pages/InventoryPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { MealsPage } from './pages/MealsPage'
import { SettingsPage } from './pages/SettingsPage'

type Page = 'catalog' | 'inventory' | 'shopping' | 'meals' | 'settings'

interface NavItem {
  id: Page
  label: string
  Icon: Icon
}

const NAV: NavItem[] = [
  { id: 'meals',     label: 'Meals',       Icon: ForkKnife   },
  { id: 'inventory', label: 'Inventory',   Icon: Package     },
  { id: 'shopping',  label: 'Shopping',    Icon: ShoppingCart },
  { id: 'catalog',   label: 'Ingredients', Icon: ListBullets },
]

function App() {
  const [page, setPage] = useState<Page>('meals')

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Top navbar */}
      <header className="navbar bg-neutral text-neutral-content shadow-sm sticky top-0 z-10">
        <div className="navbar-start">
          <span className="flex items-center gap-1.5 text-lg font-bold text-accent ml-2">
            <Leaf size={20} weight="fill" />
            Fridge
          </span>
        </div>
        <div className="navbar-end hidden sm:flex gap-1 mr-2">
          {NAV.map(({ id, label, Icon: NavIcon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`btn btn-sm gap-1.5 ${page === id ? 'btn-primary' : 'btn-ghost text-neutral-content hover:bg-neutral-content/10'}`}
            >
              <NavIcon size={16} weight={page === id ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
          {/* Settings — separate from main nav so it doesn't crowd */}
          <button
            onClick={() => setPage('settings')}
            className={`btn btn-sm btn-square ml-1 ${page === 'settings' ? 'btn-primary' : 'btn-ghost text-neutral-content hover:bg-neutral-content/10'}`}
            title="Settings"
          >
            <Gear size={17} weight={page === 'settings' ? 'fill' : 'regular'} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20 sm:pb-0">
        {page === 'catalog'   && <CatalogPage />}
        {page === 'inventory' && <InventoryPage />}
        {page === 'shopping'  && <ShoppingPage />}
        {page === 'meals'     && <MealsPage onNavigateToShopping={() => setPage('shopping')} />}
        {page === 'settings'  && <SettingsPage />}
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="btm-nav sm:hidden bg-neutral text-neutral-content">
        {NAV.map(({ id, label, Icon: NavIcon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={page === id ? 'active text-primary' : 'text-neutral-content/60'}
          >
            <NavIcon size={22} weight={page === id ? 'fill' : 'regular'} />
            <span className="btm-nav-label">{label}</span>
          </button>
        ))}
        <button
          onClick={() => setPage('settings')}
          className={page === 'settings' ? 'active text-primary' : 'text-neutral-content/60'}
        >
          <Gear size={22} weight={page === 'settings' ? 'fill' : 'regular'} />
          <span className="btm-nav-label">Settings</span>
        </button>
      </nav>
    </div>
  )
}

export default App
