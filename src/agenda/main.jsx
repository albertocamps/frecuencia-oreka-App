import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Agenda from './Agenda.jsx'
import './agenda.css'

createRoot(document.getElementById('root')).render(<StrictMode><Agenda /></StrictMode>)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    window.dispatchEvent(new Event('oreka-offline-unavailable'))
  })
}
