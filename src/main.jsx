// --------------------------------------------------------------
// src/main.jsx — ORDEN CORRECTO DE PROVIDERS (VERSIÓN FINAL 2025)
// --------------------------------------------------------------
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

// Estilos globales (ORDEN OFICIAL)
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// SweetAlert — SOLO tu tema personalizado
import './styles/swal/SwalTheme.css'

// App principal
import App from './App.jsx'

// Providers
import { FirebaseProvider } from './context/FirebaseContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { CarritoProvider } from './context/CarritoContext.jsx'
import { CatalogoProvider } from './context/CatalogoContext.jsx'
import { PedidosProvider } from './context/PedidosContext.jsx'
import { QrProvider } from './context/QrContext.jsx'
import { EntradasProvider } from './context/EntradasContext.jsx'

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
