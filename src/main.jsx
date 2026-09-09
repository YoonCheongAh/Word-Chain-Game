import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import GameHub from './GameHub'
import { AuthProvider } from './auth/AuthContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <GameHub />
    </AuthProvider>
  </StrictMode>
)
