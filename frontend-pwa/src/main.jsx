import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- IMPORT VCONSOLE ---
import VConsole from 'vconsole';

// Only load it in development or if you specifically want to debug production
// For now, let's load it everywhere so you can debug on Vercel
// const vConsole = new VConsole();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)