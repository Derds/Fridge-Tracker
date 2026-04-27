import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Request persistent storage so the browser won't evict IndexedDB data
if (navigator.storage?.persist) {
  navigator.storage.persist().then(granted => {
    if (!granted) console.warn('[storage] Persistent storage not granted — data may be evicted under storage pressure')
  })
}
