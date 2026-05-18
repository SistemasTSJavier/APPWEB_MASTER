import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { CuadriculaDataProvider } from './CuadriculaDataContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CuadriculaDataProvider>
      <App />
    </CuadriculaDataProvider>
  </StrictMode>,
)
