import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SideMenu({ id, perfil, onClose }) {
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

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
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
          boxShadow: '-6px 0 24px rgb(0 0 0 / 0.12)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
          padding: 'var(--space-6) var(--space-5)',
        }}>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
            {perfil?.nombre || '—'}
          </p>
          <span className="ds-badge ds-badge-primary" style={{
            background: 'rgb(255 255 255 / 0.2)',
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--text-xs)',
          }}>
            {perfil?.rol}
          </span>
        </div>

        {/* Links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3) 0' }}>
          {isAdmin && (
            <>
              <p className="ds-section-label" style={{ padding: 'var(--space-3) var(--space-5) var(--space-1)' }}>
                Configuración
              </p>
              <MenuItem icon="🏷️" label="Categorías" onClick={() => go('/config/categorias')} />
              <MenuItem icon="🏦" label="Cuentas"    onClick={() => go('/cuentas')} />
            </>
          )}
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
        borderRadius: 0,
        transition: 'background var(--transition)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ fontSize: '1.15rem' }}>{icon}</span>
      {label}
    </button>
  )
}
