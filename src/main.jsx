// --------------------------------------------------------------
// src/main.jsx — ORDEN CORRECTO DE PROVIDERS (FINAL)
// --------------------------------------------------------------
import React from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'sweetalert2/dist/sweetalert2.min.css'

import App from './App.jsx'

// Providers
import { QrProvider } from './context/QrContext.jsx'
import { FirebaseProvider } from './context/FirebaseContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CarritoProvider } from './context/CarritoContext.jsx'
import { PedidosProvider } from './context/PedidosContext.jsx'
import { EntradasProvider } from './context/EntradasContext.jsx'
import { CatalogoProvider } from './context/CatalogoContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FirebaseProvider>
      <AuthProvider>
        <ThemeProvider>
          <CarritoProvider>
            <CatalogoProvider>
              <PedidosProvider>
                <QrProvider>
                  <EntradasProvider>
                    <App />
                  </EntradasProvider>
                </QrProvider>
              </PedidosProvider>
            </CatalogoProvider>
          </CarritoProvider>
        </ThemeProvider>
      </AuthProvider>
    </FirebaseProvider>
  </React.StrictMode>
)
