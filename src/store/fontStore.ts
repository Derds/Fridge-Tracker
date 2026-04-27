import { create } from 'zustand'

export type FontPairing = 'simple' | 'kitchen' | 'cookbook'

export const FONT_PAIRINGS: {
  id: FontPairing
  name: string
  desc: string
  headingSample: string
  headingStack: string
  bodyStack: string
}[] = [
  {
    id: 'simple',
    name: 'Simple',
    desc: 'System fonts — fast, neutral, always available',
    headingSample: 'System UI',
    headingStack: 'system-ui, -apple-system, sans-serif',
    bodyStack: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    desc: 'Pacifico headings · Nunito body — warm and handcrafted',
    headingSample: 'Pacifico',
    headingStack: "'Pacifico', cursive",
    bodyStack: "'Nunito', sans-serif",
  },
  {
    id: 'cookbook',
    name: 'Cookbook',
    desc: 'Playfair Display headings · Source Sans 3 body — editorial',
    headingSample: 'Playfair Display',
    headingStack: "'Playfair Display', serif",
    bodyStack: "'Source Sans 3', sans-serif",
  },
]

const STORAGE_KEY = 'fridge-font'

export function applyFont(pairing: FontPairing) {
  if (pairing === 'simple') {
    document.documentElement.removeAttribute('data-font')
  } else {
    document.documentElement.setAttribute('data-font', pairing)
  }
}

interface FontStore {
  pairing: FontPairing
  setPairing: (pairing: FontPairing) => void
}

const savedPairing = (localStorage.getItem(STORAGE_KEY) as FontPairing | null) ?? 'simple'
applyFont(savedPairing)

export const useFontStore = create<FontStore>((set) => ({
  pairing: savedPairing,
  setPairing: (pairing) => {
    localStorage.setItem(STORAGE_KEY, pairing)
    applyFont(pairing)
    set({ pairing })
  },
}))
