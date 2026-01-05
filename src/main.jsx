// --------------------------------------------------------------
// src/main.jsx — ORDEN DEFINITIVO DE PROVIDERS (FINAL 2025)
// --------------------------------------------------------------
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'
import './styles/theme.css'

// Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// SweetAlert — SOLO tu tema personalizado
import './styles/swal/SwalTheme.css'

// App
import App from './App.jsx'

// Providers
import { FirebaseProvider } from './context/FirebaseContext.jsx'
import { EventoProvider } from './context/EventosContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { PedidosProvider } from './context/PedidosContext.jsx'
import { CarritoProvider } from './context/CarritoContext.jsx'
import { CatalogoProvider } from './context/CatalogoContext.jsx'
import { QrProvider } from './context/QrContext.jsx'
import { EntradasProvider } from './context/EntradasContext.jsx'
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FirebaseProvider>
      <BrowserRouter>
        <EventoProvider>
          <AuthProvider>
            <ThemeProvider>
              <PedidosProvider>
                <CarritoProvider>
                  <CatalogoProvider>
                    <QrProvider>
                      <EntradasProvider>
                        <App />
                      </EntradasProvider>
                    </QrProvider>
                  </CatalogoProvider>
                </CarritoProvider>
              </PedidosProvider>
            </ThemeProvider>
          </AuthProvider>
        </EventoProvider>
      </BrowserRouter>
    </FirebaseProvider>
  </React.StrictMode>
)
