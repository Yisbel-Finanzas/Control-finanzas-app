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
import ConfigCategorias from './pages/config/Categorias'

// Detectar flujo de invitación o recuperación antes de cualquier render
function detectAuthFlow() {
  const hash = window.location.hash
  if (hash.includes('type=invite')) return 'invite'
  if (hash.includes('type=recovery')) return 'recovery'
  return null
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [authFlow, setAuthFlow] = useState(detectAuthFlow)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

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
        <Route path="/config/categorias" element={<ConfigCategorias />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}
