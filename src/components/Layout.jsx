import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { usePerfil } from '../hooks/usePerfil'
import { useDarkMode } from '../hooks/useDarkMode'
import SideMenu from './SideMenu'
import IAFloatingButton from './IAFloatingButton'
import { IconHome, IconMoney, IconBank, IconList, IconChart, IconMenu } from './icons/NavIcons'

const tabs = [
  { to: '/dashboard',   label: 'Inicio',       Icon: IconHome  },
  { to: '/movimientos', label: 'Movimientos',   Icon: IconMoney },
  { to: '/cuentas',     label: 'Cuentas',       Icon: IconBank  },
  { to: '/deudas',      label: 'Deudas',        Icon: IconList  },
  { to: '/resumen',     label: 'Resumen',       Icon: IconChart },
]

export default function Layout({ children }) {
  const perfil = usePerfil()
  const { dark, toggle: toggleDark } = useDarkMode()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg)', isolation: 'isolate' }}>
      {/* Portrait watermark — visible en el fondo blanco (multiply) o negro (screen) */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 1,
        backgroundImage: `url(${import.meta.env.BASE_URL}img/yisbel-portrait.png)`,
        backgroundSize: 'auto 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.12,
        mixBlendMode: dark ? 'screen' : 'multiply',
        pointerEvents: 'none',
      }} />

      {/* Top bar */}
      <header role="banner" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'var(--topbar-h)',
        background: 'var(--gradient-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 var(--space-5)', zIndex: 100,
        boxShadow: '0 1px 0 rgba(255,255,255,0.08), 0 2px 10px rgba(0,0,0,0.10)',
      }}>
        <span style={{
          color: '#fff', fontWeight: 800,
          fontSize: 'var(--text-base)', letterSpacing: '-0.02em',
        }}>
          Finanzas
        </span>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="side-menu"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.22)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            width: '36px', height: '36px',
            transition: 'background var(--transition)',
          }}
        >
          <IconMenu size={20} />
        </button>
      </header>

      <main style={{
        flex: 1,
        position: 'relative',
        zIndex: 2,
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
          transition: 'background var(--transition), border-color var(--transition)',
        }}
      >
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
              paddingTop: '6px', paddingBottom: '4px',
              gap: '2px',
            }}
          >
            {({ isActive }) => (
              <>
                <span style={{
                  width: '44px', height: '26px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--color-primary-light)' : 'transparent',
                  color: isActive ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                  transition: 'background var(--transition), color var(--transition)',
                }}>
                  <Icon size={18} />
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                  letterSpacing: '0.01em',
                  transition: 'color var(--transition)',
                }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <IAFloatingButton />

      {menuOpen && (
        <SideMenu
          id="side-menu"
          perfil={perfil}
          dark={dark}
          onToggleDark={toggleDark}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
