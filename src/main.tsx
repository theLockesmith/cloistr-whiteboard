import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// DELIBERATE SMOKE TEST FAILURE — remove this line before merging
console.error('smoke-proof: createContext of undefined — runtime crash simulation')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)