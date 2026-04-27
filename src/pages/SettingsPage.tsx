import { useThemeStore, THEMES } from '../store/themeStore'

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-base-content/60 text-sm mb-6">Personalise your experience</p>

      <section>
        <h2 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-3">Appearance</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map(t => {
            const active = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`card text-left p-4 transition-all border-2 cursor-pointer
                  ${active
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-base-300 bg-base-200 hover:border-primary/40 hover:shadow-sm'
                  }`}
              >
                {/* Colour swatch row */}
                <div className="flex gap-1.5 mb-3">
                  {t.preview.map((colour, i) => (
                    <span
                      key={i}
                      className="w-6 h-6 rounded-full shadow-sm border border-black/10"
                      style={{ backgroundColor: colour }}
                    />
                  ))}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-semibold text-sm ${active ? 'text-primary' : ''}`}>{t.name}</p>
                    <p className="text-xs text-base-content/50 mt-0.5 leading-snug">{t.desc}</p>
                  </div>
                  {active && (
                    <span className="badge badge-primary badge-sm shrink-0 mt-0.5">Active</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="divider my-8" />

      <section>
        <h2 className="text-sm font-semibold text-base-content/50 uppercase tracking-wide mb-3">About</h2>
        <div className="bg-base-200 rounded-xl p-4 text-sm text-base-content/70 space-y-1">
          <p><span className="font-medium">Fridge Inventory</span> — personal, local-first pantry &amp; meal planner</p>
          <p>All data is stored on this device using IndexedDB. Nothing is sent to any server.</p>
          <p className="text-xs text-base-content/40 pt-1">Built with React, Dexie.js, Tailwind &amp; DaisyUI · FOSS stack</p>
        </div>
      </section>
    </div>
  )
}
