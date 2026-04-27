import { create } from 'zustand'

export type Theme = 'warm-pink' | 'classic' | 'dark'

export const THEMES: { id: Theme; name: string; desc: string; preview: string[] }[] = [
  {
    id: 'warm-pink',
    name: 'Warm Pink',
    desc: 'Fuchsia-tinted with vibrant India palette',
    preview: ['#B33771', '#9980FA', '#F9CA24', '#fef6fb'],
  },
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Warm cream with deep indigo',
    preview: ['#B33771', '#3B3B98', '#EAB543', '#f5f0e8'],
  },
  {
    id: 'dark',
    name: 'Dark',
    desc: 'Deep navy with vibrant accents',
    preview: ['#ED4C67', '#9980FA', '#F9CA24', '#1a1a2e'],
  },
]

const STORAGE_KEY = 'fridge-theme'

export function applyTheme(theme: Theme) {
  if (theme === 'warm-pink') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const savedTheme = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'warm-pink'
applyTheme(savedTheme)

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))
