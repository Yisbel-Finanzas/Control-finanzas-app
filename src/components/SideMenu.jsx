import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconTag, IconBank, IconMoon, IconSun, IconGoal } from './icons/NavIcons'

export default function SideMenu({ id, perfil, onClose, dark, onToggleDark }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    onClose()
  }

  function go(path) {
    navigate(path)
    onClose()
  }

  const isAdmin = perfil?.rol === 'administradora'
  const initial = (perfil?.nombre || 'U')[0].toUpperCase()

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div
        id={id}
        role="dialog"
        aria-label="Menú lateral"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
          width: '270px',
          background: 'var(--color-surface)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgb(0 0 0 / 0.12)',
          transition: 'background var(--transition)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--gradient-primary)',
          padding: 'var(--space-8) var(--space-5) var(--space-5)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.20)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 'var(--space-3)',
            color: '#fff',
            fontSize: 'var(--text-lg)', fontWeight: 800,
          }}>
            {initial}
          </div>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: '#fff', marginBottom: 'var(--space-2)', letterSpacing: '-0.01em' }}>
            {perfil?.nombre || '—'}
          </p>
          <span className="ds-badge" style={{
            background: 'rgba(255,255,255,0.20)',
            color: 'rgba(255,255,255,0.92)',
            fontSize: 'var(--text-xs)',
            border: '1px solid rgba(255,255,255,0.24)',
            textTransform: 'capitalize',
          }}>
            {perfil?.rol}
          </span>
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'rgba(255,255,255,0.62)',
            marginTop: 'var(--space-3)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            Bienvenida de nuevo a tu espacio financiero
          </p>
        </div>

        {/* Links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3) 0' }}>
          {isAdmin && (
            <>
              <p className="ds-section-label" style={{ padding: 'var(--space-3) var(--space-5) var(--space-1)' }}>
                Configuración
              </p>
              <MenuItem icon={<IconTag size={18} />} label="Categorías" onClick={() => go('/config/categorias')} />
              <MenuItem icon={<IconBank size={18} />} label="Cuentas"    onClick={() => go('/cuentas')} />
            </>
          )}

          <p className="ds-section-label" style={{ padding: 'var(--space-5) var(--space-5) var(--space-1)' }}>
            Ahorro
          </p>
          <MenuItem icon={<IconGoal size={18} />} label="Metas de ahorro" onClick={() => go('/metas')} />

          <p className="ds-section-label" style={{ padding: 'var(--space-5) var(--space-5) var(--space-1)' }}>
            Apariencia
          </p>
          <MenuItem
            icon={dark ? <IconSun size={18} /> : <IconMoon size={18} />}
            label={dark ? 'Modo claro' : 'Modo oscuro'}
            onClick={onToggleDark}
          />
        </div>

        {/* Logout */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={handleLogout} className="ds-btn ds-btn-danger" style={{ width: '100%' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-5)',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 'var(--text-base)', color: 'var(--color-text-primary)',
        textAlign: 'left',
        transition: 'background var(--transition)',
        minHeight: '44px',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ color: 'var(--color-primary-hover)', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )
}
