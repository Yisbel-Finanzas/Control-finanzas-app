import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Movimientos from './pages/Movimientos'
import Cuentas from './pages/Cuentas'
import Deudas from './pages/Deudas'
import Resumen from './pages/Resumen'
import Metas from './pages/Metas'
import CuentasPorCobrar from './pages/CuentasPorCobrar'
import ConfigCategorias from './pages/config/Categorias'
import ConfigPresupuesto from './pages/config/Presupuesto'

// Detecta el flujo de invitación/recuperación desde el hash (links antiguos,
// ya resueltos automáticamente por supabase-js al cargar el cliente).
function detectAuthFlowFromHash() {
  const hash = window.location.hash
  if (hash.includes('type=invite')) return 'invite'
  if (hash.includes('type=recovery')) return 'recovery'
  return null
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [authFlow, setAuthFlow] = useState(null)
  const [checkingLink, setCheckingLink] = useState(true)

  useEffect(() => {
    async function procesarLinkDeCorreo() {
      // Los links de invitación/recuperación ahora llegan como
      // ?token_hash=...&type=invite (ver plantillas de correo en Supabase),
      // en vez del formato #access_token=... que Supabase resuelve solo con
      // un GET — eso permite que un escáner de enlaces del correo (Gmail,
      // antivirus, etc.) consuma el token antes de que la usuaria lo toque.
      // Con token_hash, el canje solo ocurre acá, vía JS en un navegador real.
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (tokenHash && (type === 'invite' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        window.history.replaceState(null, '', window.location.pathname)
        if (!error) setAuthFlow(type)
      } else {
        setAuthFlow(detectAuthFlowFromHash())
      }
      setCheckingLink(false)
    }
    procesarLinkDeCorreo()

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (checkingLink) return null

  // Flujo de invitación o recuperación de contraseña
  if (authFlow) {
    return <SetPassword mode={authFlow} onDone={() => setAuthFlow(null)} />
  }

  if (session === undefined) return null

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/cuentas" element={<Cuentas />} />
        <Route path="/deudas" element={<Deudas />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
        <Route path="/config/categorias" element={<ConfigCategorias />} />
        <Route path="/config/presupuesto" element={<ConfigPresupuesto />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}
