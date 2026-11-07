import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
<<<<<<< HEAD
=======
import { applyPreferences, readPreferences, PREF_STORAGE_KEY } from './shared/lib/userPreferences'

applyPreferences(readPreferences())
window.addEventListener('storage', (event) => {
  if (event.key === PREF_STORAGE_KEY || event.key === null) applyPreferences(readPreferences())
})
>>>>>>> 678fcbf (separate repository to flownote-service)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
