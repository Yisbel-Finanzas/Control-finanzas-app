import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SideMenu({ perfil, onClose }) {
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
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: '260px', background: '#fff',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ background: '#2563eb', color: '#fff', padding: '1.25rem 1rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{perfil?.nombre}</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>{perfil?.rol}</p>
        </div>

        {/* Links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
          {isAdmin && (
            <>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', padding: '0.5rem 1rem 0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configuración
              </p>
              <MenuItem icon="🏷️" label="Categorías" onClick={() => go('/config/categorias')} />
              <MenuItem icon="🏦" label="Cuentas" onClick={() => go('/config/cuentas')} />
            </>
          )}
        </div>

        {/* Logout */}
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0.75rem' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '0.7rem', borderRadius: '8px',
            border: '1px solid #fee2e2', background: '#fff', color: '#dc2626',
            cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
          }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 1rem', background: 'none', border: 'none',
      cursor: 'pointer', fontSize: '0.9rem', color: '#111827',
      textAlign: 'left',
    }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      {label}
    </button>
  )
}
