import { create } from 'zustand'

export interface RecipeBlog {
  id: string
  name: string
  url: string
  notes?: string
  addedAt: string
}

interface RecipeBlogStore {
  blogs: RecipeBlog[]
  addBlog: (name: string, url: string, notes?: string) => void
  removeBlog: (id: string) => void
  updateBlog: (id: string, patch: Partial<Pick<RecipeBlog, 'name' | 'url' | 'notes'>>) => void
}

function load(): RecipeBlog[] {
  try {
    return JSON.parse(localStorage.getItem('recipe-blogs') ?? '[]')
  } catch {
    return []
  }
}

function save(blogs: RecipeBlog[]) {
  localStorage.setItem('recipe-blogs', JSON.stringify(blogs))
}

export const useRecipeBlogStore = create<RecipeBlogStore>((set, get) => ({
  blogs: load(),

  addBlog: (name, url, notes) => {
    const blog: RecipeBlog = { id: crypto.randomUUID(), name, url, notes, addedAt: new Date().toISOString() }
    const blogs = [blog, ...get().blogs]
    save(blogs)
    set({ blogs })
  },

  removeBlog: (id) => {
    const blogs = get().blogs.filter(b => b.id !== id)
    save(blogs)
    set({ blogs })
  },

  updateBlog: (id, patch) => {
    const blogs = get().blogs.map(b => b.id === id ? { ...b, ...patch } : b)
    save(blogs)
    set({ blogs })
  },
}))
