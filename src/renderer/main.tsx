import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import { App } from './App'
import { Toaster } from './components/ui/toaster'
import './styles.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
)
