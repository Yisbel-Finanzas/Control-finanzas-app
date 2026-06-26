import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Movimientos from './pages/Movimientos'
import Cuentas from './pages/Cuentas'
import Deudas from './pages/Deudas'
import Resumen from './pages/Resumen'
import ConfigCategorias from './pages/config/Categorias'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

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
        <Route path="/" element={<Navigate to="/movimientos" replace />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/cuentas" element={<Cuentas />} />
        <Route path="/deudas" element={<Deudas />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/config/categorias" element={<ConfigCategorias />} />
        <Route path="*" element={<Navigate to="/movimientos" replace />} />
      </Routes>
    </Layout>
  )
}