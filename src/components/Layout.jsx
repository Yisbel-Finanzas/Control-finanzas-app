import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { usePerfil } from '../hooks/usePerfil'
import SideMenu from './SideMenu'

const tabs = [
  { to: '/movimientos', label: 'Movimientos', icon: '💸' },
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
  { to: '/deudas', label: 'Deudas', icon: '📋' },
  { to: '/resumen', label: 'Resumen', icon: '📊' },
]

export default function Layout({ children }) {
  const perfil = usePerfil()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Top bar with hamburger */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '48px',
        background: '#2563eb', display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end', padding: '0 1rem', zIndex: 100,
      }}>
        <button onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', color: '#fff',
          fontSize: '1.4rem', cursor: 'pointer', padding: '0.25rem 0.5rem',
          lineHeight: 1,
        }}>
          ☰
        </button>
      </div>

      <main style={{ flex: 1, overflowY: 'auto', paddingTop: '48px', paddingBottom: '64px' }}>
        {children}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '64px', background: '#fff',
        borderTop: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'stretch',
        zIndex: 100,
      }}>
        {tabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '2px',
            textDecoration: 'none', fontSize: '0.65rem', fontWeight: 500,
            color: isActive ? '#2563eb' : '#6b7280',
            borderTop: isActive ? '2px solid #2563eb' : '2px solid transparent',
            transition: 'color 0.15s',
          })}>
            <span style={{ fontSize: '1.25rem' }}>{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {menuOpen && <SideMenu perfil={perfil} onClose={() => setMenuOpen(false)} />}
    </div>
  )
}
