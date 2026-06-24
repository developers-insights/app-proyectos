import React from 'react'
import { createRoot } from 'react-dom/client'
import InsightsApp from './InsightsApp.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InsightsApp />
  </React.StrictMode>
)
