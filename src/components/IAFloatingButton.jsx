import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { useAnalisisIA } from '../hooks/useAnalisisIA'
import { IconSparkles, IconX } from './icons/NavIcons'

function mesLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

export default function IAFloatingButton() {
  const perfil = usePerfil()
  const [open, setOpen] = useState(false)
  const { analisis, loading, error, analizar, limpiar } = useAnalisisIA()

  if (perfil?.rol !== 'administradora') return null

  async function handleOpen() {
    setOpen(true)
    limpiar()
    // Fetch movimientos del mes actual
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const desde = `${year}-${String(month).padStart(2, '0')}-01`
    const hasta = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('movimientos')
      .select('tipo, monto, moneda, fecha, categorias(nombre)')
      .is('deleted_at', null)
      .gte('fecha', desde)
      .lte('fecha', hasta)
    analizar(data || [], mesLabel(year, month))
  }

  function handleClose() {
    setOpen(false)
    limpiar()
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={handleOpen}
        aria-label="Análisis IA"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottomnav-h) + var(--space-4))',
          left: 'var(--space-4)',
          zIndex: 90,
          width: 52, height: 52,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(124,58,237,0.40), 0 2px 8px rgba(124,58,237,0.22)',
          transition: 'transform 180ms ease-out, box-shadow 180ms ease-out',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <IconSparkles size={22} />
      </button>

      {/* Sheet */}
      {open && (
        <div
          className="ds-sheet-overlay"
          onClick={handleClose}
          style={{ zIndex: 200 }}
        >
          <div
            className="ds-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Análisis financiero con IA"
            aria-modal="true"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="ds-sheet-handle" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ marginBottom: 'var(--space-1)' }}>Análisis con IA ✨</h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {mesLabel(new Date().getFullYear(), new Date().getMonth() + 1)}
                </p>
              </div>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 'var(--space-1)' }}
                aria-label="Cerrar"
              >
                <IconX size={20} />
              </button>
            </div>

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '92%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '78%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '88%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '65%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '82%' }} />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
                  Analizando tus finanzas…
                </p>
              </div>
            )}

            {error && (
              <div role="alert" style={{
                background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                fontSize: 'var(--text-sm)', lineHeight: 1.5,
              }}>
                {error}
                <button
                  onClick={handleOpen}
                  style={{ display: 'block', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Reintentar
                </button>
              </div>
            )}

            {analisis && (
              <>
                <div style={{
                  fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                  lineHeight: 1.8, whiteSpace: 'pre-wrap',
                  marginBottom: 'var(--space-5)',
                }}>
                  {analisis}
                </div>
                <button
                  onClick={handleOpen}
                  className="ds-btn ds-btn-ghost"
                  style={{ width: '100%' }}
                >
                  Nuevo análisis
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
