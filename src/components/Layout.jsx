import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { usePerfil } from '../hooks/usePerfil'
import SideMenu from './SideMenu'
import { IconMoney, IconBank, IconList, IconChart, IconMenu } from './icons/NavIcons'

const tabs = [
  { to: '/movimientos', label: 'Movimientos', Icon: IconMoney },
  { to: '/cuentas',     label: 'Cuentas',     Icon: IconBank  },
  { to: '/deudas',      label: 'Deudas',      Icon: IconList  },
  { to: '/resumen',     label: 'Resumen',     Icon: IconChart },
]

export default function Layout({ children }) {
  const perfil = usePerfil()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Top bar */}
      <header role="banner" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'var(--topbar-h)',
        background: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 var(--space-5)', zIndex: 100,
        boxShadow: '0 1px 4px rgb(0 0 0 / 0.15)',
      }}>
        <span style={{ color: 'var(--color-text-inverse)', fontWeight: 700, fontSize: 'var(--text-base)', letterSpacing: '-0.01em' }}>
          Finanzas
        </span>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="side-menu"
          style={{
            background: 'none', border: 'none',
            color: 'var(--color-text-inverse)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <IconMenu size={22} />
        </button>
      </header>

      <main style={{
        flex: 1,
        paddingTop: 'var(--topbar-h)',
        paddingBottom: 'var(--bottomnav-h)',
      }}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        role="navigation"
        aria-label="Navegación principal"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 'var(--bottomnav-h)',
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'stretch',
          zIndex: 100,
        }}
      >
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              textDecoration: 'none',
              fontSize: 'var(--text-xs)', fontWeight: 500,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderTop: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              transition: 'color var(--transition)',
            })}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {menuOpen && (
        <SideMenu
          id="side-menu"
          perfil={perfil}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
